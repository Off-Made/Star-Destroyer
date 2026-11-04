// Stampa gli URL di rete locale e un QR code da scansionare col telefono.
import os from 'node:os';
import qrcode from 'qrcode-terminal';

const port = Number(process.env.PORT || 5173);
const ips = Object.values(os.networkInterfaces()).flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
console.log('\n  STAR DESTROYER – dev server');
console.log(`  PC:       http://localhost:${port}/`);
for (const ip of ips) console.log(`  Telefono: http://${ip}:${port}/`);
if (ips[0]) {
  console.log('\n  Scansiona col telefono (stessa rete Wi-Fi):\n');
  qrcode.generate(`http://${ips[0]}:${port}/`, { small: true });
}
