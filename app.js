const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const seedGroups = [
  {key:'today',label:'Today',date:'November 10, 2026',iso:'2026-11-10',queries:[
    ['Google Sans Flex font','14:42'],['minimal portfolio website examples','14:38','images'],['best coffee shops near me','13:16'],['Kyoto autumn travel guide','12:54'],['Japanese garden photography','12:49','images'],['weather this weekend','11:32'],['ceramic coffee cup handmade','10:46'],['how to make pour over coffee','10:40'],['Dieter Rams design principles','09:58'],['Braun radio design','09:52','images'],['London Design Museum opening hours','09:34'],['pasta with roasted tomatoes','08:47']]},
  {key:'yesterday',label:'Yesterday',date:'November 9, 2026',iso:'2026-11-09',queries:[
    ['weekend train trips from London','20:18'],['Cotswolds walking routes','20:03'],['running shoes for beginners','18:52'],['New Balance 1080 review','18:46'],['Swiss graphic design posters','17:24','images'],['Josef Müller-Brockmann grid systems','17:12'],['easy vegetarian lunch ideas','12:38'],['Notion keyboard shortcuts','11:20'],['museum exhibitions November London','10:17'],['best books on typography','09:43']]},
  {key:'older',label:'Sunday, November 8',date:'2026',iso:'2026-11-08',queries:[
    ['mid century modern living room','18:12','images'],['Eames chair history','17:56'],['indoor plants low light','16:14'],['Monstera care guide','16:08'],['sourdough starter recipe','13:32'],['independent bookshops London','11:47'],['film photography for beginners','10:28'],['Kodak Portra 400 examples','10:16','images']]},
  {key:'older',label:'Saturday, November 7',date:'2026',iso:'2026-11-07',queries:[
    ['Lake District hiking routes','19:42'],['train tickets London to Windermere','19:30'],['waterproof hiking jacket reviews','18:11'],['autumn colour palette','15:48','images'],['how to care for wool sweaters','14:22'],['slow cooker vegetable soup','12:06'],['local farmers market Saturday','09:13'],['sunrise time London','08:24']]}
];
const seed = seedGroups.flatMap((g,gi) => g.queries.map(([query,time,type='web'],i)=>({id:`${gi}-${i}`,query,time,type,key:g.key,label:g.label,date:g.date,iso:g.iso})));
const storageKey = 'search-history-study-v1';
let saved;
try { saved=JSON.parse(localStorage.getItem(storageKey)); } catch {}
let records = Array.isArray(saved?.records) ? saved.records : structuredClone(seed);
let saving = typeof saved?.saving === 'boolean' ? saved.saving : true;
let pendingAction;
let toastTimer;
let lastConfirmationTrigger;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({records,saving}));}catch{notify('Changes are available for this session only.');}}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function searchUrl(record){return `https://www.google.com/search?q=${encodeURIComponent(record.query)}${record.type==='images'?'&udm=2':''}`;}
function highlighted(text,filter){
  if(!filter)return escapeHTML(text);
  let start=0,out='';const lower=text.toLowerCase();
  while(true){const index=lower.indexOf(filter,start);if(index<0){out+=escapeHTML(text.slice(start));break;}out+=escapeHTML(text.slice(start,index))+'<mark>'+escapeHTML(text.slice(index,index+filter.length))+'</mark>';start=index+filter.length;}
  return out;
}
function render(){
  window.historyInteractions?.beforeRender();
  $('history-toggle').setAttribute('aria-checked',String(saving));
  $('saving-label').textContent=saving?'Saving history':'History off';
  $('paused-note').hidden=saving;
  $('delete-all').disabled=!records.length;
  const filter=$('filter-query').value.trim().toLowerCase(),date=$('date-filter').value;
  $('clear-filter').hidden=!filter;
  const markedOnly=$('marked-filter').getAttribute('aria-pressed')==='true';
  const matching=records.filter(r=>(date==='all'||r.key===date)&&r.query.toLowerCase().includes(filter)&&(!markedOnly||r.marked));
  $('record-count').textContent=filter||date!=='all'||markedOnly?`${matching.length} ${matching.length===1?'search':'searches'} found`:`${records.length} saved searches · Newest first`;
  if(!$('history-panel').hidden)positionHistory();
  if(!matching.length){
    const filtered=!!filter||date!=='all'||markedOnly;
    const markedEmpty=markedOnly&&!filter&&date==='all';
    $('history-list').innerHTML=`<div class="empty-state">${icon(markedEmpty?'bookmark':filtered?'search':'history')}<h2>${markedEmpty?'No marked searches yet':filtered?'No matching searches':'No search history yet'}</h2><p>${markedEmpty?'Mark a search to find it here.':filtered?'Try a different word, date, or filter.':saving?'Your saved searches will appear here.':'Turn on history to start saving new searches.'}</p>${filtered?'<button class="text-button" id="reset-filters">Clear filters</button>':''}</div>`;
    $('reset-filters')?.addEventListener('click',()=>{$('filter-query').value='';$('date-filter').value='all';$('marked-filter').setAttribute('aria-pressed','false');render();$('filter-query').focus();});
    return;
  }
  const groups=Map.groupBy?Map.groupBy(matching,r=>r.iso):matching.reduce((m,r)=>{if(!m.has(r.iso))m.set(r.iso,[]);m.get(r.iso).push(r);return m;},new Map());
  $('history-list').innerHTML=[...groups].map(([iso,items])=>`<section class="day-group" aria-label="${escapeHTML(items[0].label)}"><div class="day-heading"><div class="day-label"><h2>${escapeHTML(items[0].label)}</h2><time datetime="${iso}">${escapeHTML(items[0].date)}</time></div><span class="day-count">${items.length} searches</span></div><div class="card-grid">${items.map(r=>renderRecord(r,filter)).join('')}</div></section>`).join('');
}
function renderRecord(r,filter){
  const id=escapeHTML(r.id),query=escapeHTML(r.query);
  return `<article class="history-card${r.marked?' is-marked':''}" data-record-id="${id}"><div class="card-actions" id="actions-${id}" aria-hidden="true" inert><button class="card-action mark-action" data-mark="${id}" aria-label="${r.marked?'Unmark':'Mark'} search: ${query}">${icon('bookmark')}<span>${r.marked?'Unmark':'Mark'}</span></button><button class="card-action delete-action" data-delete="${id}" aria-label="Delete search: ${query}">${icon('trash')}<span>Delete</span></button></div><div class="card-surface"><a class="record-link" href="${searchUrl(r)}" target="_blank" rel="noopener" draggable="false" title="Search again: ${query}"><span class="record-icon">${r.type==='images'?icon('image'):'<img src="assets/google-g.png" alt="" draggable="false">'}</span><span class="record-copy"><span class="record-title">${r.marked?`<span class="marked-indicator" role="img" aria-label="Marked">${icon('bookmark')}</span>`:''}<strong>${highlighted(r.query,filter)}</strong></span><span class="record-meta"><span>${r.type==='images'?'Google Images':'Google Search'}</span><span class="dot">·</span><time datetime="${r.iso}T${r.time}">${r.time}</time></span></span></a><button class="icon-button row-options" data-options="${id}" aria-label="Actions for search: ${query}" aria-expanded="false" aria-controls="actions-${id}" title="Mark or delete">${icon('more')}</button></div></article>`;
}
function positionHistory(){
  const anchor=document.querySelector('.search-actions').getBoundingClientRect();
  const bottom=Math.ceil(document.querySelector('.page-footer').getBoundingClientRect().height)+16;
  const panel=$('history-panel');
  const chrome=[...panel.children].filter(element=>element.id!=='history-scroll'&&!element.hidden).reduce((total,element)=>{
    const style=getComputedStyle(element);
    return total+element.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);
  },0);
  const minimumHeight=Math.max(320,Math.ceil(chrome)+98);
  const top=Math.max(16,Math.min(Math.round(anchor.bottom+12),window.innerHeight-bottom-minimumHeight));
  document.documentElement.style.setProperty('--history-top',`${top}px`);
  document.documentElement.style.setProperty('--history-bottom',`${bottom}px`);
}
function openHistory(){const panel=$('history-panel');const wasHidden=panel.hidden;positionHistory();panel.hidden=false;$('history-shadow').hidden=false;panel.inert=false;panel.removeAttribute('aria-hidden');$('history-trigger').setAttribute('aria-expanded','true');$('suggestions').hidden=true;render();window.historyMotion?.open(wasHidden);$('filter-query').focus({preventScroll:true});}
function closeHistory(restoreFocus=true){const panel=$('history-panel');if(panel.hidden||panel.dataset.phase==='closing')return;$('history-trigger').setAttribute('aria-expanded','false');panel.inert=true;panel.setAttribute('aria-hidden','true');window.historyInteractions?.beforeRender();const finish=()=>{panel.hidden=true;$('history-shadow').hidden=true;panel.dataset.phase='closed';};if(window.historyMotion)window.historyMotion.close(finish);else finish();if(restoreFocus)$('history-trigger').focus({preventScroll:true});}
window.addEventListener('resize',positionHistory);
function confirmation(title,description,actionLabel,action,kind='trash'){
  lastConfirmationTrigger=document.activeElement;
  $('dialog-title').textContent=title;$('dialog-description').textContent=description;$('accept-confirmation').textContent=actionLabel;
  $('dialog-icon').innerHTML=`<use href="#${kind}"/>`;
  pendingAction=action;$('confirmation').showModal();$('cancel-confirmation').focus();
}
function setSaving(value){saving=value;persist();render();notify(value?'Search history is on. New searches will be saved.':'Search history is off. Past searches are still available.');}
$('history-trigger').addEventListener('click',()=>$('history-trigger').getAttribute('aria-expanded')==='true'?closeHistory():openHistory());
$('close-history').addEventListener('click',()=>closeHistory());
$('filter-query').addEventListener('input',()=>{render();$('history-scroll').scrollTop=0;});
$('date-filter').addEventListener('change',()=>{render();$('history-scroll').scrollTop=0;});
$('clear-filter').addEventListener('click',()=>{$('filter-query').value='';render();$('filter-query').focus();});
$('marked-filter').addEventListener('click',()=>{const button=$('marked-filter');button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));render();$('history-scroll').scrollTop=0;});
$('reset-demo').addEventListener('click',()=>{
  records=structuredClone(seed);saving=true;
  $('filter-query').value='';$('date-filter').value='all';$('marked-filter').setAttribute('aria-pressed','false');$('main-query').value='';
  const url=new URL(location.href);url.searchParams.delete('state');history.replaceState(null,'',url);
  persist();render();$('history-scroll').scrollTop=0;
  notify('Demo reset. All example searches restored.');
});
$('history-toggle').addEventListener('click',()=>{
  if(!saving){setSaving(true);return;}
  confirmation('Turn off search history?',"New Google searches won't be saved to your account. Your existing search history will stay here until you delete it.",'Turn off',()=>setSaving(false),'pause');
});
$('resume-history').addEventListener('click',()=>setSaving(true));
$('delete-all').addEventListener('click',()=>confirmation('Delete all search history?',`This will permanently delete all ${records.length} saved searches, including searches outside the current filter. You can't undo this. ${saving?'New searches will still be saved.':'Search history will remain off.'}`,'Delete all',()=>{records=[];persist();render();notify('All search history deleted.');}));
$('history-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-delete]');if(!button)return;
  const record=records.find(r=>r.id===button.dataset.delete);if(!record)return;
  confirmation('Delete this search?',`“${record.query}” will be permanently deleted from your search history. You can't undo this.`,'Delete',()=>{
    const card=[...$('history-list').querySelectorAll('[data-record-id]')].find(element=>element.dataset.recordId===record.id);
    const remove=()=>{records=records.filter(r=>r.id!==record.id);persist();render();notify('Search deleted.');$('filter-query').focus({preventScroll:true});};
    if(window.historyInteractions&&card)window.historyInteractions.remove(card,remove);else remove();
  });
});
$('cancel-confirmation').addEventListener('click',()=>$('confirmation').close());
$('accept-confirmation').addEventListener('click',()=>{const action=pendingAction;pendingAction=undefined;$('confirmation').close();action?.();});
$('confirmation').addEventListener('close',()=>{if(lastConfirmationTrigger?.isConnected){lastConfirmationTrigger.focus();}else{$('filter-query').focus();}});
$('confirmation').addEventListener('click',e=>{if(e.target===$('confirmation')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!$('confirmation').open){if(!$('suggestions').hidden){$('suggestions').hidden=true;}else if(!$('utility-popover').hidden){$('utility-popover').hidden=true;}else if(!$('history-panel').hidden){closeHistory();}}});
function renderSuggestions(){
  if(!$('history-panel').hidden)closeHistory(false);
  const filter=$('main-query').value.trim().toLowerCase();
  const recent=records.filter(r=>!filter||r.query.toLowerCase().includes(filter)).slice(0,4);
  $('suggestions').innerHTML=recent.map(r=>`<button class="suggestion" data-query="${escapeHTML(r.query)}">${icon('history')}<span>${escapeHTML(r.query)}</span></button>`).join('')+`<button class="suggestion manage" id="suggestion-manage">${icon('history')}View all search history</button>`;
  $('suggestions').hidden=false;
}
$('main-query').addEventListener('focus',renderSuggestions);
$('main-query').addEventListener('input',renderSuggestions);
$('suggestions').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.id==='suggestion-manage'){openHistory();}else{$('main-query').value=b.dataset.query;$('suggestions').hidden=true;$('main-search').requestSubmit();}});
document.addEventListener('pointerdown',event=>{if(!$('history-panel').hidden&&!$('confirmation').open&&!event.target.closest('#history-panel,#history-trigger,.suggestions,#settings-history'))closeHistory(false);});
document.addEventListener('click',event=>{if(!event.target.closest('.main-search,.suggestions'))$('suggestions').hidden=true;if(!event.target.closest('#utility-popover,#apps-button,#account-button,#settings-button'))$('utility-popover').hidden=true;});
$('main-search').addEventListener('submit',event=>{
  event.preventDefault();const query=$('main-query').value.trim();if(!query){$('main-query').focus();return;}
  if(saving){const now=new Date();records.unshift({id:crypto.randomUUID(),query,time:now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),type:'web',key:'today',label:'Today',date:'November 10, 2026',iso:'2026-11-10'});persist();render();}
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`,'_blank','noopener');$('suggestions').hidden=true;
});
function utility(html){$('utility-popover').style.top='65px';$('utility-popover').style.bottom='auto';$('utility-popover').innerHTML=html;$('utility-popover').hidden=false;}
$('apps-button').addEventListener('click',()=>utility('<a href="https://mail.google.com/">Gmail</a><a href="https://drive.google.com/">Drive</a><a href="https://maps.google.com/">Maps</a><a href="https://photos.google.com/">Photos</a>'));
$('account-button').addEventListener('click',()=>utility('<strong>Alex Morgan</strong><p>Fictional demo account</p><a href="https://myaccount.google.com/" target="_blank" rel="noopener">Manage your Google Account</a>'));
$('settings-button').addEventListener('click',()=>{utility('<a href="https://www.google.com/preferences" target="_blank" rel="noopener">Search settings</a><button class="text-button" id="settings-history">Search history</button>');$('utility-popover').style.top='auto';$('utility-popover').style.bottom='56px';$('settings-history').addEventListener('click',()=>{$('utility-popover').hidden=true;openHistory();});});
document.querySelector('.voice').addEventListener('click',()=>notify('Voice search is represented visually in this prototype.'));
document.querySelector('.lens').addEventListener('click',()=>window.open('https://lens.google/','_blank','noopener'));
const state=new URLSearchParams(location.search).get('state');
if(state==='off'){saving=false;}
if(state==='empty'){records=[];}
render();
if(['open','off','empty'].includes(state))openHistory();

