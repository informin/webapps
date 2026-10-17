"use strict";
(function () {
  const bank = Array.isArray(window.C_QUIZ_BANK) ? window.C_QUIZ_BANK : [];
  const byId = new Map(bank.map(q => [q.id, q]));
  const STORAGE = "informin_cquiz_v1";
  const TITLES = {short:"단답형",trace:"프로그램 실행 결과",blank:"코드 빈칸 넣기",debug:"오류 수정",apply:"프로그램 응용"};
  let data = loadData();
  let session = null;

  function el(id){return document.getElementById(id);}
  function loadData(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return {
        stats:raw.stats && typeof raw.stats === "object" ? raw.stats : {},
        wrong:Array.isArray(raw.wrong) ? raw.wrong.filter(id=>byId.has(id)) : [],
        session:raw.session && typeof raw.session === "object" ? raw.session : null
      };
    }catch{return {stats:{},wrong:[],session:null};}
  }
  function save(){
    try { localStorage.setItem(STORAGE, JSON.stringify(data)); }
    catch { /* private browsing/storage blocked: the current session still works */ }
  }
  function show(which){
    for(const id of ["home","quiz","result"])el(id).hidden = which!==id;
    window.scrollTo({top:0,behavior:"instant"});
  }
  function setInfo(text){el("homeInfo").textContent=text;}
  function updateHome(){
    const answered=Object.values(data.stats).reduce((sum,r)=>sum+(r.attempts||0),0);
    el("history").textContent="이 브라우저의 누적 채점: "+answered+"회 · 다시 풀 문제: "+data.wrong.length+"개";
    el("reviewWrong").disabled=!data.wrong.length;
    const resumable = data.session && Array.isArray(data.session.ids) &&
      data.session.ids.length && data.session.ids.every(id=>byId.has(id));
    el("resume").hidden=!resumable;
    const unit=el("unit").value, kind=el("kind").value;
    const pool=bank.filter(q=>(unit==="all"||q.unit===unit)&&(kind==="all"||q.type===kind));
    setInfo("현재 조건에서 "+pool.length+"문제를 출제할 수 있습니다. 문제를 시작할 때 순서는 무작위로 정해집니다.");
  }
  function shuffle(array){
    const a=array.slice();
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  function launch(ids){
    if(!ids.length){setInfo("출제할 문항이 없습니다.");return;}
    session={ids:ids.slice(),index:0,graded:{},drafts:{}};
    data.session=session;
    save(); renderQuiz();
  }
  function start(){
    const unit=el("unit").value, kind=el("kind").value, number=el("count").value;
    const pool=bank.filter(q=>(unit==="all"||q.unit===unit)&&(kind==="all"||q.type===kind));
    const selected=shuffle(pool).slice(0,number==="all"?pool.length:Math.min(Number(number),pool.length));
    launch(selected.map(q=>q.id));
  }
  function getQ(){return byId.get(session.ids[session.index]);}
  function normal(text,type){
    let x=String(text??"").normalize("NFKC").trim().toLowerCase();
    x=x.replace(/\r\n/g,"\n");
    if(type==="trace")return x.replace(/\s+/g," ");
    return x.replace(/\s+/g,"");
  }
  function isRight(q,answer){
    if(q.type==="debug")return String(answer)===String(q.options.indexOf(q.answer));
    const n=normal(answer,q.type);
    return [q.answer].concat(q.accept || []).some(a=>n===normal(a,q.type));
  }
  function currentAnswer(){
    const q=getQ();
    if(q.type==="debug"){
      const checked=el("answerArea").querySelector("input:checked");
      return checked?checked.value:"";
    }
    return el("response").value;
  }
  function rememberDraft(){
    if(!session)return;
    const q=getQ();
    if(!session.graded[q.id]){
      session.drafts[q.id]=currentAnswer();
      save();
    }
  }
  function node(tag,cls,text){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function renderAnswer(q,oldAnswer,locked){
    const root=el("answerArea");
    root.replaceChildren();
    if(q.type==="debug"){
      q.options.forEach((choice,i)=>{
        const label=node("label","option");
        const input=document.createElement("input");
        input.type="radio"; input.name="debugAnswer"; input.value=String(i);
        input.checked=String(oldAnswer)===String(i);
        input.disabled=locked;
        label.classList.toggle("selected",input.checked);
        input.addEventListener("change",()=>{
          root.querySelectorAll(".option").forEach(x=>x.classList.remove("selected"));
          label.classList.add("selected");
          rememberDraft();
        });
        label.append(input,node("span","",String(i+1)+". "+choice));
        root.append(label);
      });
      el("answerTitle").textContent="수정 방법 선택";
      el("hint").textContent="보기 하나를 골라 채점하기를 누르세요.";
    }else{
      const input=document.createElement("input");
      input.id="response"; input.type="text"; input.maxLength=350;
      input.autocomplete="off";
      input.spellcheck=false;
      input.placeholder=q.type==="trace"?"예: 15 또는 2 4 6":"정답을 입력하세요";
      input.value=oldAnswer||"";input.disabled=locked;
      input.addEventListener("input",rememberDraft);
      input.addEventListener("keydown",event=>{
        if(event.key==="Enter"&&!locked){event.preventDefault();grade();}
      });
      root.append(input);
      el("answerTitle").textContent=q.type==="trace"?"실행 결과 입력":"정답 입력";
      el("hint").textContent=q.type==="trace"?"값과 출력되는 문자 순서대로 입력하세요. 줄바꿈과 연속 공백은 같은 공백으로 취급합니다.":"코드 공백 차이는 무시합니다. 설명을 읽고 답안을 작성하세요.";
    }
  }
  function feedback(q,result){
    const box=el("feedback");box.replaceChildren();
    box.className="feedback"+(result.correct?"":" bad");
    box.append(node("div","status",result.correct?"✓ 정답입니다!":"✕ 다시 확인해 보세요."));
    box.append(node("div","label","정답"));
    box.append(node("div","answer-key",q.answer));
    box.append(node("div","label","해설"));
    box.append(node("div","why",q.explanation));
    box.append(node("div","tiny-help","교재 참고: "+q.page+"쪽 · "+q.unit));
    box.hidden=false;
  }
  function renderQuiz(){
    if(!session||!Array.isArray(session.ids)||!session.ids.length){show("home");return;}
    session.index=Math.min(Math.max(0,session.index),session.ids.length-1);
    const q=getQ();
    if(!q){show("home");return;}
    show("quiz");
    const graded=session.graded[q.id];
    el("position").textContent="문제 "+(session.index+1)+" / "+session.ids.length;
    const total=Object.keys(session.graded).length;
    el("progress").style.width=String(Math.round(total/session.ids.length*100))+"%";
    el("typeBadge").textContent=TITLES[q.type];
    el("unitBadge").textContent=q.unit;
    el("pageBadge").textContent="교재 "+q.page+"쪽";
    el("question").textContent=q.prompt;
    el("code").hidden=!q.code;
    el("code").textContent=q.code||"";
    const answer=graded?graded.answer:(session.drafts[q.id]||"");
    renderAnswer(q,answer,Boolean(graded));
    el("feedback").hidden=!graded;
    if(graded)feedback(q,graded);
    el("grade").disabled=Boolean(graded);
    el("grade").textContent=graded?"채점 완료":"채점 및 해설";
    el("prev").disabled=session.index===0;
    el("next").textContent=session.index===session.ids.length-1?"결과 보기 →":"다음 문제 →";
    data.session=session; save();
  }
  function grade(){
    if(!session)return;
    const q=getQ();
    if(session.graded[q.id])return;
    const answer=currentAnswer().trim();
    if(!answer){el("hint").textContent="답을 입력하거나 보기를 선택한 뒤 채점하세요.";return;}
    const correct=isRight(q,answer);
    const result={answer,correct};
    session.graded[q.id]=result;
    session.drafts[q.id]=answer;
    const stat=data.stats[q.id]||{attempts:0,corrects:0};
    stat.attempts++;
    if(correct)stat.corrects++;
    data.stats[q.id]=stat;
    const wrong=new Set(data.wrong);
    if(correct)wrong.delete(q.id);
    else wrong.add(q.id);
    data.wrong=[...wrong];
    save();
    renderQuiz();
  }
  function move(offset){
    rememberDraft();
    if(!session)return;
    const next=session.index+offset;
    if(next<0)return;
    if(next>=session.ids.length){showResult();return;}
    session.index=next;renderQuiz();
  }
  function showResult(){
    if(!session)return;
    const results=session.ids.map(id=>session.graded[id]||null);
    const correct=results.filter(x=>x&&x.correct).length;
    const incorrect=results.filter(x=>x&&!x.correct).length;
    const skipped=results.filter(x=>!x).length;
    const rate=results.length?Math.round(correct/results.length*100):0;
    el("score").replaceChildren(document.createTextNode(rate+"%"),node("span","","전체 출제 문항 기준 정답률"));
    el("goodCount").textContent=correct;
    el("badCount").textContent=incorrect;
    el("skippedCount").textContent=skipped;
    el("resultMessage").textContent="총 "+results.length+"문제 중 "+correct+"개 정답, "+incorrect+"개 오답, "+skipped+"개 미응답입니다. 틀리거나 건너뛴 문제를 다시 연습할 수 있습니다.";
    el("retryWrong").disabled=!(incorrect+skipped);
    data.session=null; save(); show("result");
  }
  function retryCurrentWrong(){
    if(!session)return;
    const ids=session.ids.filter(id=>!session.graded[id]||!session.graded[id].correct);
    launch(shuffle(ids));
  }
  function retrySavedWrong(){
    launch(shuffle(data.wrong.filter(id=>byId.has(id))));
  }
  function goHome(){
    data.session=session;
    save();show("home");updateHome();
  }
  function init(){
    if(bank.length!==100){document.body.replaceChildren(node("p","","문제은행을 불러오지 못했습니다. 잠시 후 새로고침해 주세요."));return;}
    const units=[...new Set(bank.map(q=>q.unit))].sort((a,b)=>a.localeCompare(b,"ko"));
    units.forEach(u=>{const opt=document.createElement("option");opt.value=u;opt.textContent=u+" ("+bank.filter(q=>q.unit===u).length+")";el("unit").append(opt);});
    el("unit").addEventListener("change",updateHome);
    el("kind").addEventListener("change",updateHome);
    el("count").addEventListener("change",updateHome);
    el("start").addEventListener("click",start);
    el("reviewWrong").addEventListener("click",retrySavedWrong);
    el("resume").addEventListener("click",()=>{
      session=data.session;
      session.graded=session.graded||{};
      session.drafts=session.drafts||{};
      renderQuiz();
    });
    el("grade").addEventListener("click",grade);
    el("prev").addEventListener("click",()=>move(-1));
    el("next").addEventListener("click",()=>move(1));
    el("backHome").addEventListener("click",goHome);
    el("goHome").addEventListener("click",()=>{session=null;goHome();});
    el("retryWrong").addEventListener("click",retryCurrentWrong);
    el("clearHistory").addEventListener("click",()=>{
      if(confirm("저장된 채점 이력과 진행 중 연습을 모두 초기화할까요?")){
        data={stats:{},wrong:[],session:null};
        session=null; save();updateHome();setInfo("학습 기록을 초기화했습니다.");
      }
    });
    updateHome();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();