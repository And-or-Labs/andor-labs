import * as THREE from 'three';
export function createWorkstation(){
 const group=new THREE.Group();
 const metal=new THREE.MeshStandardMaterial({color:0xc4c9d2,metalness:.45,roughness:.4});
 const dark=new THREE.MeshStandardMaterial({color:0x25272e,roughness:.5});
 const paper=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85});
 function box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 box(5.2,.12,3.8,0,-.09,.6,paper);
 box(1.7,.085,1.2,0,.045,1.3,metal);
 const keys:THREE.Mesh[]=[];
 for(let row=0;row<4;row++)for(let col=0;col<11;col++)keys.push(box(.113,.023,.11,-.69+col*.138,.099,1.16+row*.145,dark));
 box(.58,.008,.22,0,.094,.88,new THREE.MeshStandardMaterial({color:0xb0b8c7}));
 const lid=new THREE.Group();lid.position.set(0,.07,1.89);lid.rotation.x=.14;group.add(lid);
 const frame=new THREE.Mesh(new THREE.BoxGeometry(1.76,1.13,.065),metal);frame.position.y=.56;lid.add(frame);frame.castShadow=true;
 const screenCanvas=document.createElement('canvas');screenCanvas.width=1024;screenCanvas.height=640;const ctx=screenCanvas.getContext('2d')!;
 const texture=new THREE.CanvasTexture(screenCanvas);texture.colorSpace=THREE.SRGBColorSpace;
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.63,.98),new THREE.MeshBasicMaterial({map:texture}));screen.rotation.y=Math.PI;screen.position.set(0,.57,-.04);lid.add(screen);
 const cup=new THREE.Mesh(new THREE.CylinderGeometry(.18,.14,.36,32),paper);cup.position.set(-1.7,.18,.65);cup.castShadow=true;group.add(cup);
 const coffee=new THREE.Mesh(new THREE.CircleGeometry(.157,32),new THREE.MeshStandardMaterial({color:0x513b29,roughness:.8}));coffee.rotation.x=-Math.PI/2;coffee.position.set(-1.7,.353,.65);group.add(coffee);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.11,.025,8,24),paper);handle.position.set(-1.89,.2,.65);group.add(handle);
 const blue=new THREE.MeshStandardMaterial({color:0x1b4dff,roughness:.9});box(.65,.09,.85,1.65,.025,.55,blue);box(.58,.06,.76,1.65,.078,.55,paper);
 const note=box(.49,.012,.4,-1.1,.012,-.6,new THREE.MeshStandardMaterial({color:0xfcf4f4}));note.rotation.y=.2;
 let last=-1;
 function update(time:number,spikes:number,decision:string){
  keys.forEach((k,i)=>{k.position.y=.099-(Math.sin(time*18+i*5)>.97?.014:0);});
  const tick=Math.floor(time*5);if(tick===last)return;last=tick;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,640);ctx.fillStyle='#1b4dff';ctx.fillRect(0,0,1024,72);ctx.fillStyle='#ffffff';ctx.font='32px monospace';ctx.fillText('JEV / SYSTEM ONE',35,49);
  ctx.fillStyle='#14151a';ctx.font='21px monospace';ctx.fillText('MEGAFLY :: MEDIA EXECUTION DESK',35,118);
  ctx.fillStyle='#6d717b';ctx.font='18px monospace';ctx.fillText('MaleCNS > memory > Jev > paper trade',35,155);
  const lines=[`neural.spikes_total = ${spikes}`,`context.remaining_budget = 10000`,`state.display.fatigue = "rising"`,`state.video.cvr = 0.034`,`decision = ${decision}`,`market.mode = "SIMULATED"`];
  lines.forEach((line,i)=>{ctx.fillStyle=i===4?'#1b4dff':'#393c44';ctx.fillText(`${String(i+1).padStart(2,'0')}  ${line}`,35,221+i*49);});
  ctx.fillStyle='#eef1ff';ctx.fillRect(25,550,970,63);ctx.fillStyle='#1b4dff';ctx.fillText('FOUR HANDS ON DECK. TWO ON THE FLOOR.',44,589);texture.needsUpdate=true;
 }
 update(0,0,'pending');return {group,update};
}
