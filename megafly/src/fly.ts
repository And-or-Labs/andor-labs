import * as THREE from 'three';

export function createFly() {
  const group = new THREE.Group();
  const cuticle = new THREE.MeshStandardMaterial({color:0xc9ac75,roughness:0.82});
  const pale = new THREE.MeshStandardMaterial({color:0xe0cc9d,roughness:0.8});
  const dark = new THREE.MeshStandardMaterial({color:0x685139,roughness:0.9});
  const eye = new THREE.MeshStandardMaterial({color:0xb93b20,roughness:0.65});
  function ellipsoid(parent: THREE.Object3D, pos:number[], scale:number[], material:THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,32,20),material);mesh.position.set(pos[0],pos[1],pos[2]);mesh.scale.set(scale[0],scale[1],scale[2]);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  function bone(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,material= cuticle) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.65,r,a.distanceTo(b),8),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  ellipsoid(group,[0,0.94,.0],[.34,.39,.47],cuticle);
  // Overlapping abdominal plates taper toward the posterior.
  for(let i=0;i<6;i++) {const width=.34*(1-i*.105);ellipsoid(group,[0,.83-i*.018,-.38-i*.145],[width,.29*(1-i*.09),.24],i%2===0?pale:cuticle);}
  const head=new THREE.Group();head.position.set(0,1,.48);group.add(head);
  ellipsoid(head,[0,0,0],[.31,.29,.25],pale);
  for(const side of [-1,1]) {
    const eyeMesh=ellipsoid(head,[side*.255,.035,.06],[.155,.225,.185],eye);
    // Tiny facets catch the light without oversized cartoon highlights.
    const facetGeometry=new THREE.SphereGeometry(.014,5,4);
    const facetMaterial=new THREE.MeshStandardMaterial({color:0xce4a29,roughness:.72});
    const facets=new THREE.InstancedMesh(facetGeometry,facetMaterial,180);const dummy=new THREE.Object3D();
    for(let i=0;i<180;i++){const y=1-2*(i+.5)/180;const radius=Math.sqrt(1-y*y);const a=i*2.39996;dummy.position.set(side*.255+Math.cos(a)*radius*.157,.035+y*.226,.06+Math.sin(a)*radius*.188);dummy.updateMatrix();facets.setMatrixAt(i,dummy.matrix);}head.add(facets);
    eyeMesh.castShadow=true;
    ellipsoid(head,[side*.085,.04,.255],[.058,.07,.1],cuticle);
    const antenna=new THREE.Vector3(side*.14,.14,.36);bone(head,new THREE.Vector3(side*.075,.06,.29),antenna,.013,dark);
    for(let j=0;j<5;j++)bone(head,antenna.clone().add(new THREE.Vector3(0,j*.018,0)),antenna.clone().add(new THREE.Vector3(side*(.07-j*.01),j*.025,.015)),.002,dark);
  }
  ellipsoid(head,[0,-.16,.23],[.09,.11,.08],pale);
  // Veined, thin wings sit along the back rather than projecting like ears.
  const wings:THREE.Group[]=[];
  for(const side of [-1,1]) {
    const pivot=new THREE.Group();pivot.position.set(side*.19,1.15,.03);group.add(pivot);wings.push(pivot);
    const outline=new THREE.Shape();outline.moveTo(0,0);outline.bezierCurveTo(.13,.1,.37,-.1,.4,-.6);outline.bezierCurveTo(.47,-1.2,.26,-1.56,.12,-1.46);outline.bezierCurveTo(-.05,-1.24,-.09,-.35,0,0);
    const wing=new THREE.Mesh(new THREE.ShapeGeometry(outline,28),new THREE.MeshPhysicalMaterial({color:0xe8e4d7,transparent:true,opacity:.62,roughness:.45,side:THREE.DoubleSide,depthWrite:false}));
    wing.rotation.x=Math.PI/2;wing.scale.x=side;pivot.add(wing);pivot.rotation.y=side*.23;
    const veinMat=new THREE.LineBasicMaterial({color:0x827b69,transparent:true,opacity:.6});
    for(let i=0;i<5;i++){const pts=[new THREE.Vector3(0,.005,0),new THREE.Vector3(side*(.055+i*.053),.005,.36),new THREE.Vector3(side*(.08+i*.045),.005,1.25-i*.13)];pts.forEach(p=>p.z*=-1);pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),veinMat));}
    for(let i=0;i<4;i++){const z=-.4-i*.22;pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side*.03,.006,z),new THREE.Vector3(side*.31,.006,z-.08)]),veinMat));}
  }
  // Sparse dark setae make the silhouette read as a fruit fly at normal scale.
  const bristles:number[]=[];
  for(let i=0;i<210;i++){const y=.1+.9*((i*.618033)%1);const angle=i*2.39996;const r=Math.sqrt(1-y*y);const x=Math.cos(angle)*r*.34,z=Math.sin(angle)*r*.44;bristles.push(x,.94+y*.39,z,x*1.1,.94+y*.39+.035+(i%4)*.014,z*1.1);}
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(bristles,3)),new THREE.LineBasicMaterial({color:0x5b4a30})));
  const legs:{side:number;index:number;bones:THREE.Mesh[];joints:THREE.Mesh[]}[]=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const bones=Array.from({length:4},()=>bone(group,new THREE.Vector3(),new THREE.Vector3(0,1,0),.026,pale));
    const joints=Array.from({length:3},()=>ellipsoid(group,[0,0,0],[.031,.031,.031],cuticle));legs.push({side,index:i,bones,joints});
  }
  function update(t:number,walking:boolean,typing=false){
    const stride=walking?1:0;group.position.y=walking?Math.sin(t*15)*.012:0;
    head.rotation.x=typing ? -.08+Math.sin(t*5)*.035 : Math.sin(t*2)*.04;
    wings.forEach((w,i)=>w.rotation.z=(i===0?-1:1)*(.015+Math.sin(t*3)*.018));
    for(const leg of legs){const {side,index,bones,joints}=leg;const phase=t*10+index*Math.PI+(side===1?Math.PI:0);const sweep=Math.cos(phase)*.18*stride;const lift=Math.max(0,Math.sin(phase))*.14*stride;
      const z=.38-index*.37;const spread=index===0?.55:index===1?0:-.5;
      const pts=[new THREE.Vector3(side*.24,.85,z),new THREE.Vector3(side*.52,.69,z+spread*.55+sweep*.4),new THREE.Vector3(side*.76,.32+lift*.5,z+spread+sweep),new THREE.Vector3(side*.92,.035+lift,z+spread+sweep),new THREE.Vector3(side*1.03,.018+lift,z+spread+sweep+.08)];
      if(typing && index<2){
        const tap=Math.max(0,Math.sin(t*(index===0?17:11)+side*2+index))*0.12;
        pts[1].set(side*(index===0?.43:.59),.69,z+.3);
        pts[2].set(side*(index===0?.4:.64),.4,1.01);
        pts[3].set(side*(index===0?.34:.59),.17+tap,1.23-index*.23);
        pts[4].set(side*(index===0?.28:.56),.11+tap,1.33-index*.23);
      }
      bones.forEach((b,j)=>{const a=pts[j],c=pts[j+1];b.position.copy(a).add(c).multiplyScalar(.5);b.scale.y=a.distanceTo(c);b.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),c.clone().sub(a).normalize());});joints.forEach((j,k)=>j.position.copy(pts[k+1]));
    }
  }
  update(0,false);return {group,update};
}
