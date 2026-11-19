'use strict';
// SERVICIO EXPERIMENTAL SOLO PARA EMULADORES. Nunca desplegar en producción.
const crypto=require('node:crypto');
const PROJECT='aguilas-paso238-lab';
function onlyLab(){
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.GCLOUD_PROJECT!==PROJECT)throw Error('EMULADORES Y PROYECTO FICTICIO OBLIGATORIOS');
}
function service({auth,db,Timestamp}){
 onlyLab();
 async function requireAdmin(actorUid){
  if(typeof actorUid!=='string'||!actorUid)throw Error('actor invalido');
  const actor=await auth.getUser(actorUid);
  if(actor.disabled)throw Error('actor deshabilitado');
  const role=await db.doc('administradores/'+actorUid).get();
  if(!role.exists||role.data().activo!==true||role.data().rol!=='administrador')throw Error('administrador no autorizado');
  // Simula un backend que ya verificó un token ID reciente; NO es un endpoint público.
 }
 async function requestSession(uid){
  const user=await auth.getUser(uid);
  if(user.disabled)throw Error('cuenta deshabilitada');
  const id=crypto.randomBytes(24).toString('base64url');
  await db.doc('solicitudes_sesiones/'+id).create({uid,estado:'pendiente',creadoEn:Timestamp.now()});
  return id;
 }
 async function approve(actorUid,requestId,ttlMs=600000){
  await requireAdmin(actorUid);
  if(!Number.isInteger(ttlMs)||ttlMs<60000||ttlMs>3600000)throw Error('TTL fuera de rango');
  const reqRef=db.doc('solicitudes_sesiones/'+requestId);
  const snap=await reqRef.get();
  if(!snap.exists||snap.data().estado!=='pendiente')throw Error('solicitud no pendiente');
  const uid=snap.data().uid;
  if(uid===actorUid)throw Error('autoaprobacion bloqueada');
  const user=await auth.getUser(uid);
  if(user.disabled)throw Error('cuenta deshabilitada');
  const adminRole=await db.doc('administradores/'+uid).get();
  const readerRole=await db.doc('usuarios/'+uid).get();
  const validAdmin=adminRole.exists&&adminRole.data().activo===true&&adminRole.data().rol==='administrador';
  const validReader=readerRole.exists&&readerRole.data().activo===true&&readerRole.data().rol==='consulta';
  if(!validAdmin&&!validReader)throw Error('sin rol activo');
  const sessionId=crypto.randomBytes(24).toString('base64url');
  const ref=db.doc('sesiones_autorizadas/'+sessionId);
  await ref.create({uid,estado:'activo',expiraEn:Timestamp.fromMillis(Date.now()+ttlMs),aprobadoPor:actorUid});
  await auth.setCustomUserClaims(uid,{...(user.customClaims||{}),sessionId});
  await reqRef.update({estado:'aprobado',aprobadoPor:actorUid});
  return sessionId;
 }
 async function revoke(actorUid,sessionId){
  await requireAdmin(actorUid);
  const ref=db.doc('sesiones_autorizadas/'+sessionId);
  const snap=await ref.get();
  if(!snap.exists)throw Error('sesion inexistente');
  await ref.update({estado:'revocado'});
  return true;
 }
 return {requestSession,approve,revoke};
}
module.exports={service,onlyLab,PROJECT};
