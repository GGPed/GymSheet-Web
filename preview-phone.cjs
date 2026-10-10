const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'dist'),host='0.0.0.0',port=5185;
function currentIPv4(){
  // Use the active default route and prefer a physical adapter for phone access.
  if(process.platform==='win32'){
    const command="$ErrorActionPreference='Stop'; $routes=Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Where-Object {$_.NextHop -ne '0.0.0.0'}; $candidates=foreach($route in $routes){$adapter=Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object {$_.ifIndex -eq $route.InterfaceIndex} | Select-Object -First 1; $iface=Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex; if($iface.ConnectionState -eq 'Connected'){$addresses=Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex | Where-Object {$_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1'}; foreach($address in $addresses){[pscustomobject]@{IP=$address.IPAddress; Physical=[bool]$adapter.HardwareInterface; Metric=($route.RouteMetric+$iface.InterfaceMetric)}}}}; $selected=$candidates | Sort-Object @{Expression='Physical';Descending=$true},Metric | Select-Object -First 1; if($selected){Write-Output $selected.IP}";
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:15000});
    const ip=(result.stdout||'').trim();
    if(result.status===0&&/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))return ip;
  }
  const addresses=Object.entries(os.networkInterfaces()).flatMap(([name,rows])=>(rows||[]).filter(row=>(row.family==='IPv4'||row.family===4)&&!row.internal&&!row.address.startsWith('169.254.')).map(row=>({name,address:row.address})));
  const physical=addresses.filter(row=>!/(vpn|radmin|virtual|vethernet|hyper-v|vmware|virtualbox|tailscale|zerotier|tunnel|loopback)/i.test(row.name));
  return (physical[0]||addresses[0])?.address;
}
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.wasm':'application/wasm'};
http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(302,{Location:'/GymSheet-Web/'});return res.end()}if(!url.pathname.startsWith('/GymSheet-Web/')){res.writeHead(404);return res.end()}let relative=decodeURIComponent(url.pathname.slice('/GymSheet-Web/'.length));if(!relative)relative='index.html';const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end()}}).listen(port,host,()=>{
  const ip=currentIPv4();
  console.log('\nGymSheet Web 0.2.0-alpha.2\nServer attivo sulla porta '+port+'\n');
  if(ip)console.log('APRI QUESTO URL SUL TELEFONO (stessa Wi-Fi del PC):\n\nhttp://'+ip+':'+port+'/GymSheet-Web/\n');
  else console.log('Nessuna rete IPv4 disponibile. Collega il PC alla rete e riavvia questo script.\n');
  console.log('Lascia questa finestra aperta: il server resta attivo.\n');
}).on('error',e=>{console.error(e.message);process.exitCode=1});

