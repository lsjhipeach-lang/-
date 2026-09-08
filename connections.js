/* Shared relationships are additive: legacy records remain valid without links. */
const tripUI={page:'home',scroll:{},mapScope:'all',placeView:'list',bookingFilter:'all',checkPending:false,restoring:false};
const linkedPlace=s=>allMapPlaces().find(p=>p.id===s.placeId&&p.mapSource===s.placeSource);
const visitsFor=p=>state.schedules.filter(s=>s.placeId===p.id&&s.placeSource===p.mapSource).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
const plannedTotal=s=>(Number(s.cost)||0)*(s.costBasis==='total'?1:MEMBERS.length);
const minutes=t=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const clockText=n=>`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const actionButton=(attr,id,label)=>`<button type="button" class="secondary" ${attr}="${esc(id)}">${esc(label)}</button>`;
function syncConnections(){
  state.schedules.forEach(s=>{const p=linkedPlace(s);if(p){s.place=p.name;s.map=p.map||p.url||''}else if(s.placeId){s.placeId='';s.placeSource=''} });
  state.reservations.forEach(r=>{const s=state.schedules.find(s=>s.id===r.scheduleId);if(s){if(r.followSchedule){r.place=s.place;r.date=s.date}if(r.separateTime===false)r.time=s.reservationTime||s.time}else if(r.scheduleId)r.scheduleId=''});
  state.expenses.forEach(e=>{if(e.scheduleId&&!state.schedules.some(s=>s.id===e.scheduleId))e.scheduleId='';if(e.reservationId&&!state.reservations.some(r=>r.id===e.reservationId))e.reservationId=''});
  state.schedules.forEach(s=>{if(s.bookingManaged)refreshBookingStatus(s)});
}
function refreshBookingStatus(s){
  const rs=state.reservations.filter(r=>r.scheduleId===s.id&&r.status!=='취소');
  const order=['예약 요청','예약 예정','조사 필요','예약 완료'];
  s.reservation=order.find(status=>rs.some(r=>r.status===status))||'확인 필요';
}
syncReservationToSchedule=function(r){const s=state.schedules.find(s=>s.id===r.scheduleId);if(s){s.bookingManaged=true;refreshBookingStatus(s)}};
syncScheduleToReservation=function(s){const linked=state.reservations.filter(r=>r.scheduleId===s.id);if(linked.length)s.bookingManaged=true;linked.forEach(r=>{r.place=s.place;r.date=s.date;if(r.separateTime===false)r.time=s.reservationTime||s.time});if(s.bookingManaged)refreshBookingStatus(s)};
const originalSaveState=saveState;
saveState=function(action){syncConnections();return originalSaveState(action)};
const originalSaveMapPlace=saveMapPlace;
saveMapPlace=function(values,persist=true){const source=editing.source,id=editing.id,result=originalSaveMapPlace(values,false);if(result){const target=values.mapCategory==='food'?'food':values.mapCategory==='drink'?'drink':'saved';state.schedules.filter(s=>s.placeId===id&&s.placeSource===source).forEach(s=>s.placeSource=target);if(persist)saveState(`${result.name} 장소 정보를 수정했어요`)}return result};

function linkSelect(name,value,items,label){return `<label class="field wide"><span>${label}</span><select name="${name}"><option value="">연결 안 함</option>${items.map(i=>`<option value="${esc(i.id)}" ${i.id===value?'selected':''}>${esc(i.label)}</option>`).join('')}</select></label>`}
function scheduleChoices(){return state.schedules.map(s=>({id:s.id,label:`${s.date} ${s.time} · ${s.place}`}))}
function addEditorHTML(html){document.querySelector('#editorFields').insertAdjacentHTML('beforeend',html)}
function saveEditorThen(fn){const form=document.querySelector('#editorForm');if(!form.reportValidity())return;form.requestSubmit();if(!document.querySelector('#editorDialog').open)fn()}
function editorTransition(fn){document.querySelector('#editorDialog').close();fn()}
function attachEditorHistory(type,id){if(!tripUI.restoring){const method=history.state?.editor?'replaceState':'pushState';history[method]({page:tripUI.page,day:activeDay,editor:type,id},'')}}
const originalScheduleEditor=openScheduleEditor;
openScheduleEditor=function(id,draft={}){
  if(id&&!state.schedules.some(s=>s.id===id))return toast('삭제된 일정입니다.');
  originalScheduleEditor(id,draft);const s=id?state.schedules.find(s=>s.id===id):draft,form=document.querySelector('#editorForm');
  addEditorHTML(`<input type="hidden" name="placeId" value="${esc(s.placeId||'')}"><input type="hidden" name="placeSource" value="${esc(s.placeSource||'')}"><label class="field"><span>예상 비용 기준</span><select name="costBasis"><option value="person">1인 금액</option><option value="total" ${s.costBasis==='total'?'selected':''}>전체 금액</option></select></label><small class="field wide">종료 시간이 시작보다 이르면 다음 날 종료입니다. 최대 24시간 미만의 일정을 입력하세요.</small>`);
  form.elements.cost.min=0;form.elements.duration.min=0;form.elements.duration.max=1439;form.elements.nextTravel.min=0;
  if(id){const rs=state.reservations.filter(r=>r.scheduleId===id),es=state.expenses.filter(e=>e.scheduleId===id),p=linkedPlace(s);
    addEditorHTML(`<section class="connection-panel field wide"><b>연결된 정보</b><div class="connection-actions">${p?actionButton('data-place-detail',mapPlaceKey(p),'장소 보기'):''}${s.map?`<a class="secondary" href="${esc(s.map)}" target="_blank" rel="noopener">지도 열기</a>`:''}${actionButton('data-new-booking',id,'저장 후 예약 추가')}${actionButton('data-new-expense',id,'저장 후 지출 추가')}</div><p>예상 ${yen(plannedTotal(s))} · 실제 ${yen(es.reduce((n,e)=>n+expenseJPY(e),0))}</p><div class="connection-actions">${rs.map(r=>actionButton('data-linked-booking',r.id,`${r.status} · ${r.place}`)).join('')}${es.map(e=>actionButton('data-linked-expense',e.id,`${e.description} · ${yen(expenseJPY(e))}`)).join('')}</div></section>`);
    if(rs.length){form.elements.reservation.disabled=true;form.elements.reservation.closest('label').insertAdjacentHTML('beforeend','<small>연결된 예약에서 상태를 변경하세요.</small>')}
  }
  if(s.placeId){form.elements.place.readOnly=true;form.elements.map.readOnly=true}addEditorHTML(actionButton('data-unlink-place','','장소 연결 해제'));
  attachEditorHistory('schedule',id||'');
};
const originalBookingEditor=openBookingEditor;
openBookingEditor=function(id,draft={}){
  if(id&&!state.reservations.some(r=>r.id===id))return toast('삭제된 예약입니다.');
  originalBookingEditor(id);const form=document.querySelector('#editorForm');Object.entries(draft).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});
  const r=id?state.reservations.find(r=>r.id===id):draft;editing.previousScheduleId=r.scheduleId||'';
  form.elements.scheduleSearch.closest('label').remove();addEditorHTML(linkSelect('scheduleId',r.scheduleId,scheduleChoices(),'연결할 일정'));
  addEditorHTML(`<label class="field wide"><span><input type="checkbox" name="separateTime" ${(r.separateTime??Boolean(id&&r.scheduleId&&r.time!==(state.schedules.find(s=>s.id===r.scheduleId)?.reservationTime||state.schedules.find(s=>s.id===r.scheduleId)?.time)))?'checked':''}> 일정과 다른 예약 시간 사용</span></label>`);
  const fill=()=>{const s=state.schedules.find(s=>s.id===form.elements.scheduleId.value);if(s){form.elements.place.value=s.place;form.elements.date.value=s.date;if(!form.elements.separateTime.checked)form.elements.time.value=s.reservationTime||s.time}form.elements.place.readOnly=!!s;form.elements.date.readOnly=!!s;form.elements.time.readOnly=!!s&&!form.elements.separateTime.checked};
  form.elements.scheduleId.addEventListener('change',fill);form.elements.separateTime.addEventListener('change',fill);fill();
  if(r.scheduleId)addEditorHTML(actionButton('data-linked-schedule',r.scheduleId,'연결된 일정 보기'));
  if(id)addEditorHTML(actionButton('data-booking-expense',id,'저장 후 지출 추가'));
  attachEditorHistory('booking',id||'');
};
const originalExpenseEditor=openExpenseEditor;
openExpenseEditor=function(id,draft={}){
  if(id&&!state.expenses.some(e=>e.id===id))return toast('삭제된 지출입니다.');
  originalExpenseEditor(id);const form=document.querySelector('#editorForm'),e=id?state.expenses.find(e=>e.id===id):draft;
  addEditorHTML(linkSelect('scheduleId',e.scheduleId,scheduleChoices(),'연결할 일정')+linkSelect('reservationId',e.reservationId,state.reservations.map(r=>({id:r.id,label:`${r.date} · ${r.place}`})),'연결할 예약 (선택)'));
  const fill=()=>{const s=state.schedules.find(s=>s.id===form.elements.scheduleId.value);if(s){form.elements.date.value=s.date;form.elements.description.value=s.place;form.elements.category.value=({food:'식비',drink:'술',tour:'관광',hotel:'숙소',move:'교통',shop:'쇼핑'})[s.category]||'기타'}};
  form.elements.scheduleId.addEventListener('change',()=>{form.elements.reservationId.value='';fill()});form.elements.reservationId.addEventListener('change',()=>{const r=state.reservations.find(r=>r.id===form.elements.reservationId.value);if(r){form.elements.scheduleId.value=r.scheduleId||'';form.elements.date.value=r.date;form.elements.description.value=r.place;if(r.scheduleId)fill()}});
  if(!id){fill();const r=state.reservations.find(r=>r.id===draft.reservationId);if(r&&!r.scheduleId){form.elements.date.value=r.date;form.elements.description.value=r.place}}
  form.elements.inputAmount.min=0;if(e.scheduleId)addEditorHTML(actionButton('data-linked-schedule',e.scheduleId,'연결된 일정 보기'));attachEditorHistory('expense',id||'');
};

function showPlace(key){const p=allMapPlaces().find(p=>mapPlaceKey(p)===key);if(!p)return;editorTransition(()=>{navigate('map');renderMapDetail(p);document.querySelector('#mapDetail').scrollIntoView({block:'center'})})}
function addPlaceVisit(p){if(!p)return;const same=visitsFor(p).find(s=>s.date===activeDay);if(same&&!confirm('선택한 날짜에 이미 방문 일정이 있습니다. 추가 방문을 등록할까요? 취소하면 기존 일정을 엽니다.')){openScheduleEditor(same.id);return}const duration=placeStayMinutes(p.duration,p.category==='drink'?120:90);openScheduleEditor(null,{placeId:p.id,placeSource:p.mapSource,place:p.name,map:p.map||p.url||'',category:p.category,description:p.description||'',date:activeDay,duration,time:'12:00',end:clockText(720+duration)})}
const originalMapDetail=renderMapDetail;
renderMapDetail=function(p){
  originalMapDetail(p);const box=document.querySelector('#mapDetail'),visits=visitsFor(p),ids=new Set(visits.map(s=>s.id));box.dataset.placeKey=mapPlaceKey(p);
  const reservations=state.reservations.filter(r=>ids.has(r.scheduleId)),expenses=state.expenses.filter(e=>ids.has(e.scheduleId)||reservations.some(r=>r.id===e.reservationId));
  box.insertAdjacentHTML('beforeend',`<section class="connection-panel"><b>방문 일정</b><div class="connection-actions">${visits.map(s=>actionButton('data-linked-schedule',s.id,`${s.date.slice(5)} ${s.time}`)).join('')||'<p>연결된 일정이 없습니다.</p>'}</div><b>예약 · 지출</b><div class="connection-actions">${reservations.map(r=>actionButton('data-linked-booking',r.id,`${r.status} · ${r.date.slice(5)}`)).join('')}${expenses.map(e=>actionButton('data-linked-expense',e.id,`${e.description} · ${yen(expenseJPY(e))}`)).join('')||'<small>연결된 지출이 없습니다.</small>'}</div></section>`);
};

document.addEventListener('click',e=>{
  const b=e.target.closest('button,a');if(!b)return;const d=b.dataset;
  const handle=fn=>{e.preventDefault();e.stopImmediatePropagation();fn()};
  if('moreMenu' in d)return handle(()=>setMobileMenuOpen(!document.querySelector('#sidebar').classList.contains('open')));
  if('unlinkPlace' in d)return handle(()=>{const f=document.querySelector('#editorForm');f.elements.placeId.value='';f.elements.placeSource.value='';f.elements.place.readOnly=false;f.elements.map.readOnly=false;b.remove()});
  if('placeDetail' in d)return handle(()=>showPlace(d.placeDetail));
  if('linkedSchedule' in d)return handle(()=>editorTransition(()=>{const s=state.schedules.find(s=>s.id===d.linkedSchedule);if(s){activeDay=s.date;navigate('schedule');openScheduleEditor(s.id)}}));
  if('linkedBooking' in d)return handle(()=>editorTransition(()=>openBookingEditor(d.linkedBooking)));
  if('linkedExpense' in d)return handle(()=>editorTransition(()=>openExpenseEditor(d.linkedExpense)));
  if('newBooking' in d)return handle(()=>saveEditorThen(()=>openBookingEditor(null,{scheduleId:d.newBooking})));
  if('newExpense' in d)return handle(()=>saveEditorThen(()=>openExpenseEditor(null,{scheduleId:d.newExpense})));
  if('bookingExpense' in d)return handle(()=>{const r=state.reservations.find(r=>r.id===d.bookingExpense);saveEditorThen(()=>openExpenseEditor(null,{scheduleId:r.scheduleId,reservationId:r.id}))});
  if('addMap' in d||'addFoliage' in d||'addVisit' in d)return handle(()=>{const p=allMapPlaces().find(p=>'addVisit' in d?mapPlaceKey(p)===d.addVisit:'addFoliage' in d?p.id===d.addFoliage&&p.mapSource==='foliage':p.id===d.addMap);addPlaceVisit(p)});
  if('statTarget' in d)return handle(()=>{tripUI.bookingFilter=d.statFilter||'all';tripUI.checkPending=d.statTarget==='checklist';navigate(d.statTarget);renderAll()});

},true);
document.querySelector('#editorForm').addEventListener('change',e=>{
  if(editing?.type!=='schedule')return;const f=e.currentTarget,k=e.target.name,start=minutes(parseSmartTime(f.elements.time.value));if(!Number.isFinite(start))return;
  if(k==='time'||k==='duration'){const duration=Number(f.elements.duration.value);if(duration>=0&&duration<1440)f.elements.end.value=clockText(start+duration)}
  if(k==='end'){const end=minutes(parseSmartTime(f.elements.end.value));if(Number.isFinite(end))f.elements.duration.value=(end-start+1440)%1440}
});
document.querySelector('#editorForm').addEventListener('submit',e=>{
  const f=e.currentTarget;
  if(editing?.type==='booking'){if(!f.querySelector('[name="separateTimeValue"]'))document.querySelector('#editorFields').insertAdjacentHTML('beforeend','<input type="hidden" name="separateTimeValue">');f.elements.separateTimeValue.value=f.elements.separateTime.checked?'yes':'no';}
  if(editing?.type==='schedule'){const start=minutes(parseSmartTime(f.elements.time.value)),end=minutes(parseSmartTime(f.elements.end.value));if(Number.isFinite(start)&&Number.isFinite(end))f.elements.duration.value=(end-start+1440)%1440;}
},true);

function matchingPlaces(){const terms=mapPlaceSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);return allMapPlaces().filter(p=>(activeMapCategory==='전체'||p.category===activeMapCategory)&&terms.every(t=>[p.name,p.area,p.address,p.description].join(' ').toLowerCase().includes(t))&&(tripUI.mapScope==='all'||visitsFor(p).some(s=>s.date===activeDay)))}
const originalMapInit=initMainMap;
let dayRouteLine=null;
initMainMap=function(){
  originalMapInit();if(!window.L||!mainMap)return;
  mapMarkers.forEach(m=>m.remove());mapMarkers=[];dayRouteLine?.remove();dayRouteLine=null;
  const ps=matchingPlaces(),visits=dayData();
  ps.filter(p=>p.coordinatesVerified&&validCoordinates(p)).forEach(p=>{
    const times=visits.filter(s=>s.placeId===p.id&&s.placeSource===p.mapSource).map(s=>`${visits.indexOf(s)+1}. ${s.time}`).join(' / ');
    const m=L.marker([p.lat,p.lng],{icon:markerIcon(p.category)}).addTo(mainMap).on('click',()=>renderMapDetail(p));
    if(tripUI.mapScope==='day')m.bindTooltip(esc(`${times} ${p.name}`));mapMarkers.push(m);
  });
  if(tripUI.mapScope==='day'){
    // Only join adjacent visits with known locations; never bridge a missing stop.
    const segments=[];let segment=[];
    visits.forEach(s=>{const p=ps.find(p=>p.id===s.placeId&&p.mapSource===s.placeSource);if(p?.coordinatesVerified&&validCoordinates(p))segment.push([Number(p.lat),Number(p.lng)]);else{if(segment.length>1)segments.push(segment);segment=[]}});
    if(segment.length>1)segments.push(segment);
    if(segments.length)dayRouteLine=L.polyline(segments,{color:'#b94d2f',weight:3,dashArray:'6 6'}).addTo(mainMap);
  }
  renderMapUnlocated(ps.filter(p=>!p.coordinatesVerified||!validCoordinates(p)));
};
function renderPlaceHub(){
  document.querySelector('#placeScope').value=tripUI.mapScope;document.querySelector('#placeView').value=tripUI.placeView;
  const list=document.querySelector('#placeHubList');list.innerHTML=matchingPlaces().map(p=>`<article class="connection-panel"><b>${esc(p.name)}</b><p>${esc(p.area||p.address||'지역 확인 필요')}</p><small>${visitsFor(p).map(s=>esc(`${s.date.slice(5)} ${s.time}`)).join(' · ')||'방문 일정 없음'} · ${p.coordinatesVerified?'위치 확인됨':'위치 확인 필요'}</small><div class="connection-actions">${actionButton('data-place-detail',mapPlaceKey(p),'상세 보기')}${actionButton('data-add-visit',mapPlaceKey(p),'일정에 추가')}</div></article>`).join('')||'<p class="empty-state">조건에 맞는 장소가 없습니다.</p>';
  const unlinked=dayData().filter(s=>!linkedPlace(s));document.querySelector('#placeScopeNote').textContent=tripUI.mapScope==='day'?`선은 방문 순서이며 실제 이동 경로가 아닙니다. 장소 연결이 없는 일정 ${unlinked.length}개는 지도에서 제외됩니다.`:'장소를 한 번 등록하고 일정·예약·지출을 연결하세요.';list.hidden=tripUI.placeView!=='list';document.querySelector('#page-map .main-map-layout').classList.toggle('list-mode',tripUI.placeView==='list');
  document.querySelectorAll('[data-shared-day]').forEach(select=>{select.innerHTML=TRIP_DATES.map(d=>`<option value="${d.date}" ${d.date===activeDay?'selected':''}>${d.short} · ${d.theme}</option>`).join('')});
}
const originalRenderDrinks=renderDrinkRoutes;
renderDrinkRoutes=function(){originalRenderDrinks();document.querySelectorAll('#drinkRoutes .route-card').forEach(card=>card.hidden=!card.textContent.includes(TRIP_DATES.find(d=>d.date===activeDay)?.short));document.querySelector('#firstNightDate').textContent=activeDay;};
function renderIssues(){
  const issues=[];const ordered=[...state.schedules].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  ordered.forEach((s,i)=>{const next=ordered[i+1],start=minutes(s.time),end=minutes(s.end);if(next&&Number.isFinite(start)&&Number.isFinite(end)){const endStamp=Date.parse(`${s.date}T00:00:00`)+(end+(end<start?1440:0))*60000,nextStamp=Date.parse(`${next.date}T00:00:00`)+minutes(next.time)*60000;if(endStamp>nextStamp)issues.push([s,`${s.place} → ${next.place}: 시간이 겹칩니다`]);else if(Number(s.nextTravel)>0&&endStamp+Number(s.nextTravel)*60000>nextStamp)issues.push([s,`${s.place} → ${next.place}: 이동시간이 부족합니다`]);else if(next.date===s.date&&!Number(s.nextTravel))issues.push([s,`${s.place}: 다음 장소 이동시간 확인 필요`])}if(!['불필요','예약 완료'].includes(s.reservation)&&!state.reservations.some(r=>r.scheduleId===s.id&&r.status!=='취소'))issues.push([s,`${s.place}: 예약 연결 확인 필요`])});
  document.querySelector('#tripIssues').innerHTML=`<h3>확인할 항목 ${issues.length}개</h3><div class="connection-actions">${issues.map(([s,label])=>actionButton('data-linked-schedule',s.id,label)).join('')||'<p>확인할 일정 문제가 없습니다.</p>'}</div><h3>장소 정보 보완</h3><div class="connection-actions">${allMapPlaces().filter(p=>!p.coordinatesVerified||!p.address).map(p=>actionButton('data-place-detail',mapPlaceKey(p),`${p.name} · ${!p.coordinatesVerified?'위치':'주소'} 확인`)).join('')||'<p>보완할 장소가 없습니다.</p>'}</div>`;
}
const originalRenderAll=renderAll;
renderAll=function(){originalRenderAll();renderPlaceHub();renderIssues();
  document.querySelectorAll('#stats .stat-card').forEach((card,i)=>{if(i<2)return;const targets={2:'schedule',3:'booking',4:'booking',5:'schedule',6:'budget',7:'checklist'};card.tabIndex=0;card.role='button';card.dataset.statTarget=targets[i];card.dataset.statFilter=i===3?'pending':i===4?'done':'all';card.onclick=()=>{tripUI.bookingFilter=card.dataset.statFilter;tripUI.checkPending=i===7;navigate(targets[i]);renderAll()}});
  document.querySelectorAll('#bookingBoard .booking-column').forEach((el,i)=>el.hidden=tripUI.bookingFilter==='pending'?[3,4].includes(i):tripUI.bookingFilter==='done'?i!==3:false);
  document.querySelectorAll('#bookingBoard .booking-card').forEach(card=>{const r=state.reservations.find(r=>r.id===card.querySelector('[data-edit-booking]').dataset.editBooking);if(r.scheduleId)card.insertAdjacentHTML('beforeend',actionButton('data-linked-schedule',r.scheduleId,'일정 보기'))});
  document.querySelector('#bookingViewFilter').value=tripUI.bookingFilter;
  document.querySelector('#checkViewFilter').value=tripUI.checkPending?'pending':'all';
  document.querySelectorAll('#checklistGroups .check-row').forEach(row=>row.hidden=tripUI.checkPending&&row.querySelector('input').checked);
  if(tripUI.checkPending)document.querySelectorAll('#checklistGroups details').forEach(group=>{group.hidden=![...group.querySelectorAll('.check-row')].some(row=>!row.hidden);group.open=!group.hidden});
  const selected=document.querySelector('#mapDetail').dataset.placeKey;if(selected){const p=allMapPlaces().find(p=>mapPlaceKey(p)===selected);if(p)renderMapDetail(p);else document.querySelector('#mapDetail').innerHTML='<p>장소가 삭제되었습니다. 기존 방문 기록은 유지됩니다.</p>'}
};

const originalNavigate=navigate;
navigate=function(page){tripUI.scroll[tripUI.page]=window.scrollY;tripUI.page=page;originalNavigate(page);renderAll();document.querySelector('.mobile-nav [data-more-menu]').classList.toggle('active',['booking','checklist'].includes(page));if(['food','drinks','foliage'].includes(page))document.querySelector('.mobile-nav [data-page="map"]').classList.add('active');requestAnimationFrame(()=>window.scrollTo({top:tripUI.scroll[page]||0,behavior:'instant'}));if(!tripUI.restoring)history.pushState({page,day:activeDay},'',`#${page}`)};
window.addEventListener('popstate',e=>{tripUI.restoring=true;document.querySelector('#editorDialog').close();if(e.state?.day)activeDay=e.state.day;navigate(e.state?.page||'home');if(e.state?.editor){const fn={schedule:openScheduleEditor,booking:openBookingEditor,expense:openExpenseEditor}[e.state.editor];if(fn)fn(e.state.id||null)}tripUI.restoring=false});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-stat-target]')){e.preventDefault();e.target.click()}});
document.addEventListener('change',e=>{if(e.target.matches('[data-shared-day]')){activeDay=e.target.value;history.replaceState({...history.state,day:activeDay},'');renderAll()}if(e.target.id==='placeScope'){tripUI.mapScope=e.target.value;renderAll()}if(e.target.id==='placeView'){tripUI.placeView=e.target.value;renderAll();setTimeout(()=>mainMap?.invalidateSize(),50)}if(e.target.id==='checkViewFilter'){tripUI.checkPending=e.target.value==='pending';renderAll()}if(e.target.id==='bookingViewFilter'){tripUI.bookingFilter=e.target.value;renderAll()}});
document.addEventListener('click',e=>{if(e.target.closest('[data-day],[data-map-category]')){history.replaceState({...history.state,day:activeDay},'');renderAll()}});
document.querySelector('#mapPlaceSearch').addEventListener('input',()=>{renderPlaceHub();initMainMap()});
document.querySelector('#editorDialog').addEventListener('close',()=>{if(!tripUI.restoring&&!document.querySelector('#editorDialog').open&&history.state?.editor)history.replaceState({page:tripUI.page,day:activeDay},'')});
document.querySelector('#page-map .connection-toolbar').prepend(document.querySelector('#mapPlaceSearch').closest('label'));
document.querySelector('#placeHubList').before(document.querySelector('#page-map .map-toolbar'));
history.replaceState({page:'home',day:activeDay},'');
renderAll();
