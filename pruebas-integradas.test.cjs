'use strict';
// SOLO EMULADORES: NO se conecta a proyectos Firebase reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const {initializeApp,deleteApp} = require('firebase/app');
const {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut} = require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,deleteDoc} = require('firebase/firestore');
const PROJECT='aguilas-paso238-lab';
const HOST='127.0.0.1';
const A='SesionAdminFicticia12345', C='SesionConsultaFicticia12345';
const userAdmin='admin_ficticio', userConsulta='consulta_ficticia';
const password='Laboratorio-Ficticio-237!';
const target='registros/demo_v5';
function requireEmulators(){
 assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,HOST+':9099','Authentication Emulator obligatorio');
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST+':8080','Firestore Emulator obligatorio');
 assert.equal(process.env.GCLOUD_PROJECT||PROJECT,PROJECT,'Proyecto ficticio obligatorio');
}
async function client(label,email){
 const app=initializeApp({apiKey:'fake-api-key-paso237',authDomain:'localhost',projectId:PROJECT},'lab-'+label);
 const auth=getAuth(app);
 connectAuthEmulator(auth,'http://'+HOST+':9099',{disableWarnings:true});
 const db=getFirestore(app);
 connectFirestoreEmulator(db,HOST,8080);
 await signInWithEmailAndPassword(auth,email,password);
 return {app,auth,db};
}
test('PASO 237 - Firebase Authentication y Firestore integrados (solo emuladores)',{timeout:120000},async t=>{
 requireEmulators();
 admin.initializeApp({projectId:PROJECT});
 const authAdmin=admin.auth();
 const store=admin.firestore();
 let clients=[];
 try{
  const fakeUsers=[{uid:userAdmin,email:'admin@example.invalid',session:A},{uid:userConsulta,email:'consulta@example.invalid',session:C},{uid:'sin_rol',email:'sinrol@example.invalid',session:'SesionSinRolFicticia12345'}];
  for(const u of fakeUsers){
   await authAdmin.createUser({uid:u.uid,email:u.email,password});
   await authAdmin.setCustomUserClaims(u.uid,{sessionId:u.session});
  }
  await store.doc('administradores/'+userAdmin).set({activo:true,rol:'administrador'});
  await store.doc('usuarios/'+userConsulta).set({activo:true,rol:'consulta'});
  await store.doc(target).set({data:{prueba:'FICTICIA'}});
  await store.doc('sesiones_autorizadas/'+A).set({uid:userAdmin,estado:'activo',expiraEn:admin.firestore.Timestamp.fromMillis(Date.now()+3600000)});
  await store.doc('sesiones_autorizadas/'+C).set({uid:userConsulta,estado:'activo',expiraEn:admin.firestore.Timestamp.fromMillis(Date.now()+3600000)});
  const a=await client('admin','admin@example.invalid');clients.push(a);
  const c=await client('consulta','consulta@example.invalid');clients.push(c);
  const x=await client('sinrol','sinrol@example.invalid');clients.push(x);
  await t.test('01 admin ficticio inicia sesión con Firebase Authentication',()=>assert.equal(a.auth.currentUser.uid,userAdmin));
  await t.test('02 consulta ficticia inicia sesión con Firebase Authentication',()=>assert.equal(c.auth.currentUser.uid,userConsulta));
  await t.test('03 administrador con sesión aprobada puede leer',async()=>assert.equal((await getDoc(doc(a.db,target))).exists(),true));
  await t.test('04 consulta con sesión aprobada puede leer',async()=>assert.equal((await getDoc(doc(c.db,target))).exists(),true));
  await t.test('05 usuario sin rol no puede leer',async()=>assert.rejects(getDoc(doc(x.db,target)),e=>e.code==='permission-denied'));
  await t.test('06 consulta no puede escribir',async()=>assert.rejects(setDoc(doc(c.db,target),{data:{prueba:'FICTICIA'}}),e=>e.code==='permission-denied'));
  await t.test('07 administrador no puede eliminar registro central',async()=>assert.rejects(deleteDoc(doc(a.db,target)),e=>e.code==='permission-denied'));
  await store.doc('sesiones_autorizadas/'+C).update({estado:'revocado'});
  await t.test('08 revocar sesión bloquea nueva lectura de consulta',async()=>assert.rejects(getDoc(doc(c.db,target)),e=>e.code==='permission-denied'));
  await store.doc('usuarios/'+userConsulta).update({activo:false});
  await t.test('09 rol revocado sigue bloqueado',async()=>assert.rejects(getDoc(doc(c.db,target)),e=>e.code==='permission-denied'));
  await t.test('10 administrador autorizado puede actualizar registro ficticio',async()=>{await setDoc(doc(a.db,target),{data:{prueba:'FICTICIA_ACTUALIZADA'}});assert.equal((await store.doc(target).get()).data().data.prueba,'FICTICIA_ACTUALIZADA')});
  await t.test('11 usuario no puede crear su propia sesión autorizada',async()=>assert.rejects(setDoc(doc(c.db,'sesiones_autorizadas/SesionFraudeFicticia12345'),{uid:userConsulta,estado:'activo'}),e=>e.code==='permission-denied'));
  await signOut(a.auth);
  await t.test('12 cierre de sesión bloquea lecturas posteriores',async()=>assert.rejects(getDoc(doc(a.db,target)),e=>e.code==='permission-denied'));
 }finally{
  await Promise.allSettled(clients.map(c=>deleteApp(c.app)));
  await admin.app().delete();
 }
});
