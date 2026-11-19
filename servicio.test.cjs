'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {service,PROJECT}=require('./servicio-autorizacion.cjs');
test('PASO 238 - servicio administrativo experimental (emuladores)',{timeout:120000},async t=>{
 assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
 assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
 const app=admin.initializeApp({projectId:PROJECT},'paso238-servicio');
 const auth=app.auth(),db=app.firestore();
 const api=service({auth,db,Timestamp:admin.firestore.Timestamp});
 try{
  await auth.createUser({uid:'admin238',email:'admin238@example.invalid',password:'Ficticia_238!'});
  await auth.createUser({uid:'lector238',email:'lector238@example.invalid',password:'Ficticia_238!'});
  await auth.createUser({uid:'otro238',email:'otro238@example.invalid',password:'Ficticia_238!'});
  await db.doc('administradores/admin238').set({activo:true,rol:'administrador'});
  await db.doc('usuarios/lector238').set({activo:true,rol:'consulta'});
  await t.test('01 usuario ficticio puede solicitar aprobación',async()=>assert.ok(await api.requestSession('lector238')));
  const requestId=await api.requestSession('lector238');
  await t.test('02 no administrador no puede aprobar',async()=>assert.rejects(api.approve('otro238',requestId),/administrador no autorizado/));
  await t.test('03 duración fuera de rango rechazada',async()=>assert.rejects(api.approve('admin238',requestId,1),/TTL/));
  let sid;
  await t.test('04 administrador aprueba solicitud ficticia',async()=>{sid=await api.approve('admin238',requestId);assert.ok(sid)});
  await t.test('05 sesión queda activa con vencimiento',async()=>{const s=(await db.doc('sesiones_autorizadas/'+sid).get()).data();assert.equal(s.estado,'activo');assert.ok(s.expiraEn.toMillis()>Date.now())});
  await t.test('06 claim de sesión asignado al usuario',async()=>assert.equal((await auth.getUser('lector238')).customClaims.sessionId,sid));
  await t.test('07 solicitud aprobada no se puede reaprovechar',async()=>assert.rejects(api.approve('admin238',requestId),/no pendiente/));
  await t.test('08 usuario sin rol activo no puede aprobarse',async()=>{const r=await api.requestSession('otro238');await assert.rejects(api.approve('admin238',r),/sin rol activo/)});
  await t.test('09 administrador revoca sesión',async()=>{await api.revoke('admin238',sid);assert.equal((await db.doc('sesiones_autorizadas/'+sid).get()).data().estado,'revocado')});
  await t.test('10 no administrador no puede revocar',async()=>assert.rejects(api.revoke('lector238',sid),/administrador no autorizado/));
  await t.test('11 autoaprobación administrativa bloqueada',async()=>{const r=await api.requestSession('admin238');await assert.rejects(api.approve('admin238',r),/autoaprobacion/)});
  await t.test('12 admin deshabilitado no puede autorizar',async()=>{await auth.updateUser('admin238',{disabled:true});const r=await api.requestSession('lector238');await assert.rejects(api.approve('admin238',r),/deshabilitado/)});
 }finally{await app.delete()}
});
