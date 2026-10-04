'use strict';
const VERSION='2.98';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('anlagenbuch-shell-')).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));
// 2.98: bewusst KEIN fetch-Handler. Navigation und App-Dateien gehen direkt ans Netz.
// Medien-/IndexedDB-Daten werden nicht gelöscht.
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('/index.html?v=2.98'));});
