'use strict';
// Estos tests identifican brechas del código experimental, NO las corrigen.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const s=fs.readFileSync('servicio-autorizacion.cjs','utf8');
const r=fs.readFileSync('firestore.rules','utf8');
test('AUDITORIA 239: aprobación no usa transacción atómica (brecha)',()=>{
 assert.match(s,/const snap=await reqRef\.get\(\)/);
 assert.match(s,/await ref\.create\(/);
 assert.match(s,/await reqRef\.update\(/);
 assert.doesNotMatch(s,/runTransaction\(/);
});
test('AUDITORIA 239: claim y Firestore se actualizan por separado (brecha)',()=>{
 assert.match(s,/setCustomUserClaims/);
 assert.match(s,/await reqRef\.update/);
});
test('AUDITORIA 239: no hay evento de auditoría inmutable (brecha)',()=>{
 assert.doesNotMatch(s,/eventos_auditoria|bitacora_inmutable/);
});
test('AUDITORIA 239: autenticación del actor está simulada, sin verificar token de llamada (brecha)',()=>{
 assert.match(s,/async function requireAdmin\(actorUid\)/);
 assert.match(s,/Simula un backend/);
});
test('AUDITORIA 239: recuperación de administrador no implementada (brecha)',()=>{
 assert.doesNotMatch(s,/async function recoverAdmin|async function breakGlass/);
});
test('AUDITORIA 239: revocación marca sesión revocada (control existente)',()=>{
 assert.match(s,/await ref\.update\(\{estado:'revocado'\}\)/);
 assert.match(r,/estado == 'activo'/);
});
test('AUDITORIA 239: rol de administrador se consulta en Firestore (control existente)',()=>{
 assert.match(s,/administradores\//);
 assert.match(s,/activo!==true/);
});
test('AUDITORIA 239: laboratorio exige hosts de emuladores (control existente)',()=>{
 assert.match(s,/FIREBASE_AUTH_EMULATOR_HOST/);
 assert.match(s,/FIRESTORE_EMULATOR_HOST/);
});
