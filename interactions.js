/* SwipeRow drawer interaction and CardNav reveal rhythm, adapted for this
   dependency-free prototype. Local references are recorded in UI-POLISH.md. */
(()=>{
  const list=$('history-list'),panel=$('history-panel'),shadow=$('history-shadow'),physics=window.historySwipePhysics;
  const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active=null,grip=null,motionToken=0,panelAnimations=[];
  const cleanAnimations=()=>{panelAnimations.forEach(animation=>animation.cancel());panelAnimations=[];};
  const setDrawer=(card,open,focus=false)=>{
    if(!card?.isConnected)return;
    if(open&&active&&active!==card)setDrawer(active,false);
    card.style.setProperty('--swipe-x',open?physics.width:0);
    card.dataset.drawer=open?'open':'closed';
    const actions=card.querySelector('.card-actions'),toggle=card.querySelector('.row-options');
    actions.inert=!open;actions.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));
    if(open){active=card;if(focus)actions.querySelector('button').focus({preventScroll:true});}
    else{if(active===card)active=null;if(focus)toggle.focus({preventScroll:true});}
  };
  const cancelGrip=()=>{
    if(!grip)return;
    const {card,id,base}=grip;grip=null;delete card.dataset.dragging;
    try{card.querySelector('.card-surface').releasePointerCapture(id);}catch{}
    setDrawer(card,base>0);
  };
  window.historyInteractions={
    beforeRender(){cancelGrip();if(active)setDrawer(active,false);},
    async remove(card,commit){
      const oldPositions=new Map([...list.querySelectorAll('[data-record-id]')].map(element=>[element.dataset.recordId,element.getBoundingClientRect()]));
      if(!reduce()){
        card.inert=true;
        await card.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}],{duration:150,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished.catch(()=>{});
      }
      commit();
      if(reduce())return;
      const bounds=$('history-scroll').getBoundingClientRect();
      list.querySelectorAll('[data-record-id]').forEach(element=>{
        const before=oldPositions.get(element.dataset.recordId),after=element.getBoundingClientRect();
        if(!before||after.bottom<bounds.top||after.top>bounds.bottom)return;
        const dx=before.left-after.left,dy=before.top-after.top;
        if(Math.abs(dx)+Math.abs(dy)>1)element.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:200,easing:'cubic-bezier(.22,1,.36,1)'});
      });
    }
  };
  list.addEventListener('pointerdown',event=>{
    const surface=event.target.closest('.card-surface');
    if(!surface||event.button!==0||event.isPrimary===false||event.target.closest('button'))return;
    const card=surface.closest('[data-record-id]');
    if(active&&active!==card)setDrawer(active,false);
    grip={card,id:event.pointerId,x:event.clientX,y:event.clientY,base:card.dataset.drawer==='open'?physics.width:0,exposed:0,dragging:false};
  });
  document.addEventListener('pointermove',event=>{
    if(!grip||event.pointerId!==grip.id)return;
    const g=grip,dx=g.x-event.clientX,dy=event.clientY-g.y;
    if(!g.dragging){
      if(Math.abs(dy)>physics.hysteresis&&Math.abs(dy)>Math.abs(dx)*1.2){grip=null;return;}
      if(Math.abs(dx)<physics.hysteresis||Math.abs(dx)<Math.abs(dy)*1.3)return;
      g.dragging=true;g.card.dataset.dragging='true';
      if(active&&active!==g.card)setDrawer(active,false);
      try{g.card.querySelector('.card-surface').setPointerCapture(event.pointerId);}catch{}
    }
    if(event.cancelable)event.preventDefault();
    const distance=Math.sign(dx)*Math.max(0,Math.abs(dx)-physics.hysteresis);
    g.exposed=physics.exposure(g.base/physics.resistance+distance);
    g.card.style.setProperty('--swipe-x',g.exposed);
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    if(!grip||event.pointerId!==grip.id)return;
    const g=grip;grip=null;delete g.card.dataset.dragging;
    try{g.card.querySelector('.card-surface').releasePointerCapture(g.id);}catch{}
    if(!g.dragging)return;
    g.card.dataset.suppressClick='true';
    setTimeout(()=>delete g.card.dataset.suppressClick,400);
    setDrawer(g.card,physics.shouldOpen(g.exposed));
  });
  document.addEventListener('pointercancel',cancelGrip);
  list.addEventListener('dragstart',event=>{if(event.target.closest('.card-surface'))event.preventDefault();});
  list.addEventListener('click',event=>{
    const card=event.target.closest('[data-record-id]');
    if(!card)return;
    if(card.dataset.suppressClick==='true'){
      delete card.dataset.suppressClick;event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(event.target.closest('.record-link')&&card.dataset.drawer==='open'){
      event.preventDefault();event.stopImmediatePropagation();setDrawer(card,false);
    }
  },true);
  list.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-options]');
    if(toggle){const card=toggle.closest('[data-record-id]');setDrawer(card,card.dataset.drawer!=='open',event.detail===0);return;}
    const mark=event.target.closest('[data-mark]');
    if(!mark)return;
    const record=records.find(item=>item.id===mark.dataset.mark);if(!record)return;
    record.marked=!record.marked;persist();render();
    const replacement=[...list.querySelectorAll('[data-record-id]')].find(card=>card.dataset.recordId===record.id);
    if(event.detail===0)(replacement?.querySelector('.row-options')||$('marked-filter')).focus({preventScroll:true});
    if(record.marked&&!reduce())replacement?.querySelector('.marked-indicator')?.animate([{transform:'scale(.7)',opacity:.4},{transform:'scale(1.12)',opacity:1},{transform:'scale(1)',opacity:1}],{duration:230});
    notify(record.marked?'Search marked. Find it with the Marked filter.':'Search unmarked.');
  });
  list.addEventListener('keydown',event=>{
    const card=event.target.closest('[data-record-id]');if(!card)return;
    if(event.key==='ArrowLeft'){event.preventDefault();setDrawer(card,true,true);}
    if(event.key==='ArrowRight'||event.key==='Escape'){
      if(card.dataset.drawer!=='open')return;
      event.preventDefault();setDrawer(card,false,true);
    }
  });
  document.addEventListener('pointerdown',event=>{if(active&&!active.contains(event.target)&&!$('confirmation').open)setDrawer(active,false);});
  window.addEventListener('resize',()=>window.historyInteractions.beforeRender());
  window.addEventListener('blur',cancelGrip);

  window.historyMotion={
    open(wasHidden){
      const token=++motionToken,current=wasHidden?null:getComputedStyle(panel).clipPath;
      const shadowStart={height:wasHidden?56:shadow.getBoundingClientRect().height,opacity:wasHidden?0:getComputedStyle(shadow).opacity};
      cleanAnimations();panel.dataset.phase='opening';
      if(reduce()){panel.dataset.phase='open';return;}
      const height=panel.getBoundingClientRect().height;
      panelAnimations.push(shadow.animate([{height:`${shadowStart.height}px`,opacity:shadowStart.opacity},{height:`${height}px`,opacity:1}],{duration:290,easing:'cubic-bezier(.22,1,.36,1)'}));
      const animation=panel.animate([
        {clipPath:current&&current!=='none'?current:`inset(0px 0px ${Math.max(0,height-56)}px round 20px)`,opacity:wasHidden?.35:1},
        {clipPath:'inset(0px 0px 0px round 20px)',opacity:1}
      ],{duration:290,easing:'cubic-bezier(.22,1,.36,1)'});
      panelAnimations.push(animation);
      const bounds=$('history-scroll').getBoundingClientRect();
      [...list.querySelectorAll('.history-card')].filter(card=>{const r=card.getBoundingClientRect();return r.bottom>bounds.top&&r.top<bounds.bottom;}).slice(0,18).forEach((card,index)=>{
        panelAnimations.push(card.animate([{transform:'translateY(9px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:220,delay:55+Math.min(index*16,80),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));
      });
      animation.finished.then(()=>{if(token===motionToken)panel.dataset.phase='open';}).catch(()=>{});
    },
    close(finish){
      const token=++motionToken,current=getComputedStyle(panel).clipPath;
      const shadowStart={height:shadow.getBoundingClientRect().height,opacity:getComputedStyle(shadow).opacity};
      cleanAnimations();panel.dataset.phase='closing';
      if(reduce()){finish();return;}
      const height=panel.getBoundingClientRect().height;
      panelAnimations.push(shadow.animate([{height:`${shadowStart.height}px`,opacity:shadowStart.opacity},{height:'56px',opacity:0}],{duration:170,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}));
      const animation=panel.animate([
        {clipPath:current==='none'?'inset(0px 0px 0px round 20px)':current,opacity:1},
        {clipPath:`inset(0px 0px ${Math.max(0,height-56)}px round 20px)`,opacity:0}
      ],{duration:170,easing:'cubic-bezier(.4,0,1,1)'});
      panelAnimations.push(animation);
      animation.finished.then(()=>{if(token===motionToken)finish();}).catch(()=>{});
    }
  };
})();
