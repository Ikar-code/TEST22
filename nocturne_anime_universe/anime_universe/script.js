// NOCTURNE — interactions and scroll choreography
const eyeField = document.querySelector('#eyeField');
const eyePositions = [
  [0,0],[0,2],[0,4],[0,6],[1,1],[1,3],[1,5],[2,0],[2,2],[2,4],[2,6],
  [3,1],[3,3],[3,5],[4,0],[4,2],[4,4],[4,6],[1,0],[3,6],[0,3],[4,3]
];
eyePositions.forEach(([r,c],i)=>{
  const eye=document.createElement('span'); eye.className='eye';
  eye.style.gridRow=r+1; eye.style.gridColumn=c+1;
  eye.style.transform=`rotate(45deg) scale(${.65+(i%4)*.14})`;
  eyeField.appendChild(eye);
});
const progressBar=document.querySelector('#progressBar');
window.addEventListener('scroll',()=>{
  const max=document.documentElement.scrollHeight-window.innerHeight;
  progressBar.style.width=(window.scrollY/max*100)+'%';
},{passive:true});

if(window.gsap && window.ScrollTrigger){
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.intro-title',{y:90,opacity:0,duration:1.3,ease:'power4.out',delay:.2});
  gsap.from('.throne-person',{y:100,opacity:0,duration:1.5,ease:'power3.out',delay:.5});
  gsap.to('.eye',{scale:1.35,opacity:1,stagger:{each:.025,from:'random'},ease:'none',
    scrollTrigger:{trigger:'.intro',start:'top top',end:'bottom top',scrub:1}});
  gsap.to('.throne-person',{scale:1.45,y:-80,ease:'none',
    scrollTrigger:{trigger:'.intro',start:'top top',end:'bottom top',scrub:1}});
  gsap.fromTo('.fall-person',{y:-260,rotation:180},{y:450,rotation:180,ease:'none',
    scrollTrigger:{trigger:'.descent',start:'top bottom',end:'bottom top',scrub:1}});
  gsap.fromTo('.slash-sword',{rotation:35,x:-100},{rotation:-50,x:150,ease:'none',
    scrollTrigger:{trigger:'.slash-scene',start:'top 80%',end:'center center',scrub:1}});
  gsap.fromTo('.slash-flash',{scaleX:0},{scaleX:1,ease:'none',
    scrollTrigger:{trigger:'.slash-scene',start:'center center',end:'bottom top',scrub:1}});
  gsap.fromTo('.impact-person',{y:220,rotation:-25},{y:-20,rotation:0,ease:'none',
    scrollTrigger:{trigger:'.impact',start:'top bottom',end:'center center',scrub:1}});
  gsap.fromTo('.crack-overlay',{opacity:0,scale:1.08},{opacity:1,scale:1,ease:'none',
    scrollTrigger:{trigger:'.impact',start:'center center',end:'bottom top',scrub:1}});
  gsap.from('.profile-card',{y:80,opacity:0,stagger:.18,duration:1,ease:'power3.out',
    scrollTrigger:{trigger:'.profiles',start:'top 75%'}});
}else{
  document.querySelector('.crack-overlay').style.opacity='.7';
}

// Touch devices: tap a character row to reveal its image; normal navigation still works.
document.querySelectorAll('.character-row').forEach(row=>{
  row.addEventListener('touchstart',()=>row.classList.add('touched'),{passive:true});
});
