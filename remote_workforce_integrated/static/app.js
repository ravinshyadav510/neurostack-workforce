/* ====== Remote Workforce Task Management System - v2 ====== */
var API = "/api";
function $(id) { return document.getElementById(id); }
var appEl = document.getElementById("app");

var state = {
  page: "dashboard", user: null, summary: {}, tasks: [], projects: [], users: [],
  updates: [], notifications: [], report: [], taskComments: [], perf: {},
  leaderboard: [], attendance: null, attendanceHistory: [], leaves: [],
  calendarTasks: [], calMonth: new Date().getMonth(), calYear: new Date().getFullYear(),
  filters: { employee: "", status: "", priority: "" }
};

/* ====== Auth ====== */
function token() { return localStorage.getItem("token"); }
function setToken(t) { localStorage.setItem("token", t); }
function clearToken() { localStorage.removeItem("token"); }
function isManager() { return state.user && (state.user.role === "manager" || state.user.role === "admin" || state.user.role === "super_admin"); }
function isAdmin() { return state.user && (state.user.role === "admin" || state.user.role === "super_admin"); }

/* ====== API ====== */
async function api(path, options) {
  options = options || {};
  var headers = options.headers || {};
  if (!options.isUpload) headers["Content-Type"] = "application/json";
  if (token()) headers.Authorization = "Bearer " + token();
  var res = await fetch(API + path, Object.assign({}, options, { headers: headers }));
  if (!res.ok) {
    var msg = "Request failed";
    try { var d = await res.json(); msg = d.detail || msg; } catch(e) {}
    throw new Error(msg);
  }
  var ct = res.headers.get("content-type") || "";
  if (ct.indexOf("json") >= 0) return res.json();
  return res;
}

/* ====== Utilities ====== */
function esc(v) { return String(v==null?"":v).replace(/[&<>"']/g,function(s){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s];}); }
function fmtDate(v) { if(!v)return "No deadline"; return new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }
function fmtDateTime(v) { if(!v)return""; var d=new Date(v); return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}); }
function fmtTime(v) { if(!v)return"--:--"; return new Date(v).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}); }
function badge(v) { return '<span class="badge '+esc(v)+'">'+esc(String(v||"").replace(/_/g," "))+'</span>'; }
function initials(n) { return (n||"U").split(" ").map(function(w){return w[0];}).join("").toUpperCase().slice(0,2); }
function pct(a,b) { return b>0?Math.round((a/b)*100):0; }
function getUserName(id) {
  if(state.user&&state.user.id===id) return state.user.full_name;
  var u=state.users.find(function(x){return x.id===id;});
  return u?u.full_name:"User #"+id;
}
function daysLeft(dl) {
  if(!dl)return"";
  var diff=Math.ceil((new Date(dl)-new Date())/86400000);
  if(diff<0)return'<span class="overdue">Overdue '+Math.abs(diff)+'d</span>';
  if(diff===0)return'<span class="due-today">Due today</span>';
  if(diff<=3)return'<span class="due-soon">'+diff+'d left</span>';
  return'<span class="due-normal">'+diff+'d left</span>';
}
function fileSize(b) { if(b<1024)return b+"B";if(b<1048576)return(b/1024).toFixed(1)+"KB";return(b/1048576).toFixed(1)+"MB"; }

/* ====== Data ====== */
async function load() {
  if(!token())return;
  try {
    state.user = await api("/users/me");
    var r = await Promise.all([api("/dashboard/summary"),api("/tasks/"),api("/projects/"),api("/notifications/"),api("/performance/summary")]);
    state.summary=r[0]; state.tasks=r[1]; state.projects=r[2]; state.notifications=r[3]; state.perf=r[4];
    if(isManager()) {
      var m = await Promise.all([api("/users/"),api("/dashboard/manager-report"),api("/daily-updates/"),api("/performance/leaderboard"),api("/leave/all"),api("/attendance/all-today"),api("/leave/dashboard").catch(function(){return{};}),api("/attendance/today").catch(function(){return{logs:[],summary:{}};}),api("/attendance/my-history").catch(function(){return[];})]);
      state.users=m[0]; state.report=m[1]; state.updates=m[2]; state.leaderboard=m[3]; state.leaves=m[4]; state.allAttendance=m[5]; state.leaveDash=m[6]; state.punchToday=m[7]; state.punchHistory=m[8];
    } else {
      var e = await Promise.all([api("/daily-updates/mine").catch(function(){return[];}),api("/attendance/today").catch(function(){return{logs:[],summary:{}};}),api("/attendance/my-history").catch(function(){return[];}),api("/leave/mine").catch(function(){return[];}),api("/leave/balance").catch(function(){return{balances:[],summary:{}};})]);
      state.updates=e[0]; state.punchToday=e[1]; state.punchHistory=e[2]; state.leaves=e[3]; state.leaveBalance=e[4]; state.users=[]; state.report=[];
    }
  } catch(e) { clearToken(); state.user=null; }
}
async function loadComments(id) { try{state.taskComments=await api("/tasks/"+id+"/comments/");}catch(e){state.taskComments=[];} }
async function loadCalendar() { try{state.calendarTasks=await api("/calendar/tasks?year="+state.calYear+"&month="+(state.calMonth+1));}catch(e){state.calendarTasks=[];} }

/* ====== Icons ====== */
function icon(n) {
  var m={
    dashboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 22V10a2 2 0 114 0v12"/><rect x="6" y="2" width="12" height="7" rx="1"/></svg>',
    leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 1 8-1 3.5-3.8 6-9 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  };
  return '<i class="ico">'+(m[n]||'')+'</i>';
}

/* ====== LOGIN ====== */
function renderLogin() {
  appEl.innerHTML =
    '<div class="lp">' +
      '<div class="lp-bg"><div class="lp-grid"></div><div class="lp-glow lp-glow1"></div><div class="lp-glow lp-glow2"></div><div class="lp-glow lp-glow3"></div>' +
        '<div class="lp-particles" id="lpParticles"></div>' +
        '<div class="lp-float-cards">' +
          '<div class="lp-float-card fc1"><div class="fc-bar"></div><div class="fc-bar short"></div><div class="fc-dots"><span></span><span></span><span></span></div></div>' +
          '<div class="lp-float-card fc2"><div class="fc-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" stroke="rgba(99,102,241,.3)" fill="none" stroke-width="3"/><circle cx="18" cy="18" r="15" stroke="#818cf8" fill="none" stroke-width="3" stroke-dasharray="65 100" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg></div><div class="fc-label">65%</div></div>' +
          '<div class="lp-float-card fc3"><div class="fc-mini-bars"><span style="height:40%"></span><span style="height:70%"></span><span style="height:55%"></span><span style="height:85%"></span><span style="height:45%"></span></div><div class="fc-label">Analytics</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="lp-inner">' +
        '<div class="lp-hero">' +
          '<div class="lp-badge">Enterprise Platform</div>' +
          '<h1 class="lp-title">Remote Workforce<br/><span>Management</span></h1>' +
          '<p class="lp-sub">Manage attendance, tasks, leave, reports and team productivity in one secure workspace.</p>' +
          '<div class="lp-stats">' +
            '<div class="lp-stat"><span class="lp-stat-num">98%</span><span>Task Visibility</span></div>' +
            '<div class="lp-stat"><span class="lp-stat-num">24/7</span><span>Team Monitoring</span></div>' +
            '<div class="lp-stat"><span class="lp-stat-num">Live</span><span>Attendance Sync</span></div>' +
          '</div>' +
          '<div class="lp-features">' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("clock")+'</div><div><strong>Attendance</strong><span>Punch in/out tracking</span></div></div>' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("tasks")+'</div><div><strong>Task Management</strong><span>Assign &amp; track work</span></div></div>' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("leaf")+'</div><div><strong>Leave Approval</strong><span>Request &amp; manage</span></div></div>' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("trophy")+'</div><div><strong>Performance</strong><span>Analytics &amp; reports</span></div></div>' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("people")+'</div><div><strong>Team Control</strong><span>Role-based access</span></div></div>' +
            '<div class="lp-feat"><div class="lp-feat-icon">'+icon("filter")+'</div><div><strong>Admin Panel</strong><span>Secure dashboard</span></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="lp-form-wrap">' +
          '<form class="lp-card" id="loginForm">' +
            '<div class="lp-brand">' +
              '<div class="lp-brand-logo"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nlg" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#nlg)"/><path d="M14 34V14h3.5l10 13.5V14H31v20h-3.5L17.5 20.5V34H14z" fill="white" fill-opacity="0.95"/><path d="M31 14h3v20h-3V14z" fill="white" fill-opacity="0.5"/></svg></div>' +
              '<div class="lp-brand-name">NeuroStack Systems</div>' +
              '<div class="lp-brand-tag">Enterprise Workforce Platform</div>' +
            '</div>' +
            '<div class="lp-card-divider"></div>' +
            '<div class="lp-card-head"><h2>Sign In</h2><p>Access your workspace</p></div>' +
            '<div class="lp-field"><label>Email Address</label><div class="lp-input-wrap">'+icon("send")+'<input id="email" type="email" placeholder="you@company.com" value="manager@demo.com" required /></div></div>' +
            '<div class="lp-field"><label>Password</label><div class="lp-input-wrap">'+icon("eye")+'<input id="password" type="password" placeholder="Enter password" value="manager123" required /><button type="button" class="lp-eye" onclick="togglePwdVis()">'+icon("eye")+'</button></div></div>' +
            '<div class="lp-options"><label class="lp-check"><input type="checkbox" checked /> Remember me</label><a href="#" onclick="return false">Forgot password?</a></div>' +
            '<div id="loginError"></div>' +
            '<button type="submit" class="lp-btn" id="loginBtn"><span>Sign In</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>' +
            '<div class="lp-demo">' +
              '<div class="lp-demo-title">Quick Access — Demo Accounts</div>' +
              '<div class="lp-demo-list">' +
                '<div class="lp-demo-item" onclick="fillDemo(\'superadmin@demo.com\',\'super123\')"><span class="lp-demo-badge sa">Super Admin</span><span>superadmin@demo.com</span></div>' +
                '<div class="lp-demo-item" onclick="fillDemo(\'admin@demo.com\',\'admin123\')"><span class="lp-demo-badge mgr">Admin</span><span>admin@demo.com</span></div>' +
                '<div class="lp-demo-item" onclick="fillDemo(\'manager@demo.com\',\'manager123\')"><span class="lp-demo-badge mgr">Manager</span><span>manager@demo.com</span></div>' +
                '<div class="lp-demo-item" onclick="fillDemo(\'aman@demo.com\',\'aman123\')"><span class="lp-demo-badge emp">Employee</span><span>aman@demo.com</span></div>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  $("loginForm").addEventListener("submit",async function(e){
    e.preventDefault();$("loginError").innerHTML="";
    var btn=$("loginBtn");btn.classList.add("loading");btn.disabled=true;
    try{var d=await api("/auth/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});setToken(d.access_token);await load();state.page="dashboard";render();}
    catch(err){$("loginError").innerHTML='<div class="error">'+esc(err.message)+'</div>';btn.classList.remove("loading");btn.disabled=false;}
  });
  // Spawn particles
  var pc=$("lpParticles");if(pc){for(var i=0;i<20;i++){var p=document.createElement("div");p.className="lp-particle";p.style.left=Math.random()*100+"%";p.style.top=(60+Math.random()*40)+"%";p.style.animationDuration=(4+Math.random()*6)+"s";p.style.animationDelay=(Math.random()*5)+"s";p.style.width=p.style.height=(2+Math.random()*2)+"px";pc.appendChild(p);}}
}
window.fillDemo=function(email,pwd){$("email").value=email;$("password").value=pwd;$("email").focus();};
window.togglePwdVis=function(){var p=$("password");p.type=p.type==="password"?"text":"password";};

/* ====== SHELL ====== */
function shell(content) {
  var mNav=[["dashboard","dashboard","Dashboard"],["tasks","tasks","All Tasks"],["employees","people","Employees"],["projects","folder","Projects"],["calendar","cal","Calendar"],["performance","trophy","Performance"],["attendance","clock","Attendance"],["leave","leaf","Leave Mgmt"],["daily","cal","Daily Reports"],["notifications","bell","Notifications"]];
  if(isAdmin()) mNav.splice(3,0,["usermgmt","people","User Management"]);
  var eNav=[["dashboard","dashboard","My Dashboard"],["tasks","tasks","My Tasks"],["calendar","cal","Calendar"],["attendance","clock","Attendance"],["leave","leaf","Leave"],["daily","cal","Daily Update"],["notifications","bell","Notifications"]];
  var nav=isManager()?mNav:eNav;
  var unread=state.notifications.filter(function(n){return!n.is_read;}).length;
  var navHtml=nav.map(function(n){
    var a=state.page===n[0]?" active":"";
    var nb=n[0]==="notifications"&&unread>0?'<span class="nav-badge">'+unread+'</span>':"";
    return'<button class="nav-btn'+a+'" onclick="go(\''+n[0]+'\')">'+icon(n[1])+'<span>'+n[2]+'</span>'+nb+'</button>';
  }).join("");
  var pt=(nav.find(function(n){return n[0]===state.page;})||nav[0])[2];
  return '<div class="app-shell">' +
    '<div class="sidebar-overlay" onclick="toggleSidebar()"></div>' +
    '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-brand"><div class="brand-logo"><svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="slg" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#slg)"/><path d="M14 34V14h3.5l10 13.5V14H31v20h-3.5L17.5 20.5V34H14z" fill="white" fill-opacity="0.95"/><path d="M31 14h3v20h-3V14z" fill="white" fill-opacity="0.5"/></svg></div><div class="brand-text"><strong>NeuroStack</strong><span>'+(isManager()?"Manager Panel":"Employee Portal")+'</span></div></div>' +
      '<nav class="sidebar-nav">'+navHtml+'</nav>' +
      '<div class="sidebar-profile"><div class="avatar-circle">'+initials(state.user.full_name)+'</div><div class="profile-info"><strong>'+esc(state.user.full_name)+'</strong><span>'+badge(state.user.role)+'</span></div><button class="btn-icon" onclick="logout()" title="Logout">'+icon("logout")+'</button></div>' +
    '</aside>' +
    '<main class="main-area">' +
      '<header class="topbar">' +
        '<div class="topbar-left"><button class="hamburger" onclick="toggleSidebar()"><span></span><span></span><span></span></button><h1>'+esc(pt)+'</h1></div>' +
        '<div class="topbar-right">' +
          '<div class="topbar-notif" onclick="go(\'notifications\')">'+icon("bell")+(unread>0?'<span class="notif-dot">'+unread+'</span>':"")+'</div>' +
          '<div class="topbar-user"><div class="avatar-sm">'+initials(state.user.full_name)+'</div></div>' +
        '</div>' +
      '</header>' +
      '<div class="page-content">'+content+'</div>' +
    '</main>' +
  '</div>';
}

/* ====== LIVE VISUAL HELPERS ====== */
function _buildBarChart(s) {
  var max = Math.max(s.total_tasks || 1, 1);
  var bars = [
    {label:"Done", val:s.completed||0, color:"var(--green)"},
    {label:"Active", val:s.in_progress||0, color:"var(--blue)"},
    {label:"Pending", val:s.pending||0, color:"var(--amber)"},
    {label:"Blocked", val:s.blocked||0, color:"var(--red)"}
  ];
  return '<div class="bar-chart">' + bars.map(function(b) {
    var h = Math.max(8, (b.val / max) * 120);
    return '<div class="bar-col"><div class="bar-fill-v anim-grow" style="height:'+h+'px;background:'+b.color+'"></div><span class="bar-val">'+b.val+'</span><span class="bar-label">'+b.label+'</span></div>';
  }).join("") + '</div>';
}

function _buildLiveFeed() {
  var items = [];
  var now = new Date();
  // Build from real data
  state.tasks.slice(0, 3).forEach(function(t) {
    var who = getUserName(t.assigned_to_id);
    if (t.status === "completed") items.push({text: who + ' completed "' + t.title + '"', time: "recently", type: "green"});
    else if (t.status === "in_progress") items.push({text: who + ' is working on "' + t.title + '"', time: "active", type: "blue"});
    else if (t.status === "blocked") items.push({text: who + ' blocked on "' + t.title + '"', time: "needs help", type: "red"});
  });
  if (state.allAttendance && state.allAttendance.employees) {
    state.allAttendance.employees.forEach(function(a) {
      if (a.status === "working") items.push({text: a.name + " is currently working", time: "now", type: "green"});
      else if (a.status === "on_break") items.push({text: a.name + " is on break", time: "break", type: "amber"});
      else if (a.status === "pending") items.push({text: a.name + " has not checked in", time: "pending", type: "red"});
    });
  }
  return items.slice(0, 6).map(function(it, i) {
    return '<div class="feed-item anim-slide" style="animation-delay:'+((i*80))+'ms"><span class="feed-dot '+it.type+'"></span><span class="feed-text">'+esc(it.text)+'</span><span class="feed-time">'+it.time+'</span></div>';
  }).join("") || '<p class="muted sm">No activity</p>';
}

/* ============================================================
   MANAGER DASHBOARD
============================================================ */
function managerDashboard() {
  var s=state.summary,p=state.perf,cp=pct(s.completed,s.total_tasks);
  var empRows=state.report.map(function(r){
    var pr=pct(r.completed_tasks,r.total_tasks);
    return '<tr><td><div class="emp-cell"><div class="avatar-xs">'+initials(r.employee)+'</div><div><strong>'+esc(r.employee)+'</strong><span class="muted">'+esc(r.email)+'</span></div></div></td>' +
      '<td class="center">'+r.total_tasks+'</td><td class="center"><span class="text-green">'+r.completed_tasks+'</span></td><td class="center"><span class="text-amber">'+r.pending_tasks+'</span></td><td class="center"><span class="text-blue">'+r.in_progress_tasks+'</span></td><td class="center"><span class="text-red">'+r.blocked_tasks+'</span></td>' +
      '<td><div class="progress-bar"><div class="progress-fill" style="width:'+pr+'%"></div></div><span class="muted sm">'+pr+'%</span></td></tr>';
  }).join("");
  var reviewTasks=state.tasks.filter(function(t){return t.status==="under_review";});
  var reviewHtml=reviewTasks.length>0?reviewTasks.map(function(t){
    return '<div class="activity-row clickable" onclick="viewTask('+t.id+')"><div class="activity-dot under_review"></div><div class="activity-body"><strong>'+esc(t.title)+'</strong><span class="muted">by '+esc(getUserName(t.assigned_to_id))+'</span></div>'+badge("under_review")+'</div>';
  }).join(""):'<p class="muted sm">No tasks pending review</p>';

  return shell(
    '<div class="stats-row">' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'total\')"><div class="stat-icon blue">'+icon("tasks")+'</div><div class="stat-body"><span class="stat-val">'+(s.total_tasks||0)+'</span><span class="stat-label">Total Tasks</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'completed\')"><div class="stat-icon green">'+icon("check")+'</div><div class="stat-body"><span class="stat-val">'+(s.completed||0)+'</span><span class="stat-label">Completed</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'in_progress\')"><div class="stat-icon amber">'+icon("clock")+'</div><div class="stat-body"><span class="stat-val">'+(s.in_progress||0)+'</span><span class="stat-label">In Progress</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'blocked\')"><div class="stat-icon red">'+icon("bell")+'</div><div class="stat-body"><span class="stat-val">'+(s.blocked||0)+'</span><span class="stat-label">Blocked</span></div></div>' +
    '</div>' +
    '<div class="stats-row sm">' +
      '<div class="stat-card mini clickable" onclick="popupDashCard(\'pending\')"><span class="stat-val">'+(s.pending||0)+'</span><span class="stat-label">Pending</span></div>' +
      '<div class="stat-card mini clickable" onclick="popupDashCard(\'employees\')"><span class="stat-val">'+(s.total_employees||0)+'</span><span class="stat-label">Employees</span></div>' +
      '<div class="stat-card mini clickable" onclick="popupDashCard(\'overdue\')"><span class="stat-val">'+(p.overdue_tasks||0)+'</span><span class="stat-label">Overdue</span></div>' +
      '<div class="stat-card mini clickable" onclick="popupDashCard(\'under_review\')"><span class="stat-val">'+cp+'%</span><span class="stat-label">Completion</span></div>' +
    '</div>' +
    '<div class="grid-2">' +
      '<div class="card"><div class="card-header"><h3>Employee Performance</h3><button class="btn-sm" onclick="window.open(\'/api/export/employee-report-csv\')">'+icon("download")+' Export CSV</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Employee</th><th class="center">Total</th><th class="center">Done</th><th class="center">Pending</th><th class="center">Active</th><th class="center">Blocked</th><th>Progress</th></tr></thead>' +
      '<tbody>'+(empRows||'<tr><td colspan="7" class="muted center">No data</td></tr>')+'</tbody></table></div></div>' +
      '<div>' +
        '<div class="card" style="margin-bottom:18px"><div class="card-header"><h3>Task Distribution</h3></div>' +
          '<div class="live-chart">' + _buildBarChart(s) + '</div>' +
        '</div>' +
        '<div class="card"><div class="card-header"><h3>Live Activity</h3><span class="live-dot-label"><span class="live-dot"></span> Live</span></div>' +
          '<div class="live-feed" id="liveFeed">' + _buildLiveFeed() + '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/* ====== MANAGER TASKS ====== */
function managerTasks() {
  var emps=state.users.filter(function(u){return u.role==="employee";});
  var empO='<option value="">All Employees</option>'+emps.map(function(u){return'<option value="'+u.id+'"'+(state.filters.employee==u.id?" selected":"")+'>'+esc(u.full_name)+'</option>';}).join("");
  var stO='<option value="">All Status</option>'+["pending","in_progress","under_review","completed","blocked"].map(function(s){return'<option value="'+s+'"'+(state.filters.status===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("");
  var prO='<option value="">All Priority</option>'+["low","medium","high","urgent"].map(function(p){return'<option value="'+p+'"'+(state.filters.priority===p?" selected":"")+'>'+p+'</option>';}).join("");
  var ft=state.tasks.filter(function(t){
    if(state.filters.employee&&t.assigned_to_id!=state.filters.employee)return false;
    if(state.filters.status&&t.status!==state.filters.status)return false;
    if(state.filters.priority&&t.priority!==state.filters.priority)return false;
    return true;
  });
  var rows=ft.map(function(t){
    var an=getUserName(t.assigned_to_id);
    return'<tr><td><div><strong>'+esc(t.title)+'</strong><p class="muted sm">'+esc((t.description||"").slice(0,50))+'</p></div></td>' +
      '<td><div class="emp-cell"><div class="avatar-xs">'+initials(an)+'</div><span>'+esc(an)+'</span></div></td>' +
      '<td>'+badge(t.priority)+'</td><td>'+badge(t.status)+'</td><td>'+fmtDate(t.deadline)+'<br>'+daysLeft(t.deadline)+'</td>' +
      '<td class="actions"><button class="btn-sm" onclick="viewTask('+t.id+')" title="View">'+icon("eye")+'</button><button class="btn-sm" onclick="editTask('+t.id+')" title="Edit">'+icon("edit")+'</button><button class="btn-sm danger" onclick="deleteTask('+t.id+')" title="Delete">'+icon("trash")+'</button></td></tr>';
  }).join("");
  return shell(
    '<div class="page-toolbar"><div class="filter-bar">'+icon("filter")+'<select id="filterEmp" onchange="applyFilters()">'+empO+'</select><select id="filterStatus" onchange="applyFilters()">'+stO+'</select><select id="filterPrio" onchange="applyFilters()">'+prO+'</select><input id="taskSearch" placeholder="Search..." onkeyup="filterTaskSearch()"/></div>' +
    '<div style="display:flex;gap:8px"><button class="btn-sm" onclick="window.open(\'/api/export/tasks-csv\')">'+icon("download")+' CSV</button><button class="btn primary" onclick="showCreateTask()">'+icon("plus")+' New Task</button></div></div>' +
    '<div class="card no-pad"><table id="taskTable"><thead><tr><th>Task</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="muted center">No tasks</td></tr>')+'</tbody></table></div>'
  );
}

/* ====== EMPLOYEES ====== */
function managerEmployees() {
  var cards=state.report.map(function(r){
    var p=pct(r.completed_tasks,r.total_tasks);
    return'<div class="emp-card"><div class="emp-card-top"><div class="avatar-lg">'+initials(r.employee)+'</div><div><h3>'+esc(r.employee)+'</h3><span class="muted">'+esc(r.email)+'</span></div></div>' +
    '<div class="emp-stats"><div><span class="emp-stat-val">'+r.total_tasks+'</span><span>Total</span></div><div><span class="emp-stat-val text-green">'+r.completed_tasks+'</span><span>Done</span></div><div><span class="emp-stat-val text-amber">'+r.pending_tasks+'</span><span>Pending</span></div><div><span class="emp-stat-val text-blue">'+r.in_progress_tasks+'</span><span>Active</span></div></div>' +
    '<div class="progress-bar lg"><div class="progress-fill" style="width:'+p+'%"></div></div><span class="muted sm">'+p+'% completed</span>' +
    '<button class="btn outline full" onclick="state.filters.employee=\''+r.user_id+'\';go(\'tasks\')">View Tasks</button></div>';
  }).join("");
  return shell('<div class="page-toolbar"><h3>'+state.report.length+' Employees</h3><button class="btn primary" onclick="showAddEmployee()">'+icon("plus")+' Add Employee</button></div><div class="emp-grid">'+(cards||'<p class="muted">No employees</p>')+'</div>');
}

/* ====== PROJECTS ====== */
function projectsPage() {
  var list=state.projects.map(function(p){
    var tc=state.tasks.filter(function(t){return t.project_id===p.id;}).length;
    var dc=state.tasks.filter(function(t){return t.project_id===p.id&&t.status==="completed";}).length;
    var pr=pct(dc,tc);
    return'<div class="project-card"><div class="project-header"><h3>'+esc(p.name)+'</h3>'+badge(p.status)+'</div><p class="muted">'+esc(p.description||"")+'</p><div class="project-meta"><span>'+tc+' tasks</span><span>'+fmtDate(p.deadline)+'</span></div><div class="progress-bar"><div class="progress-fill" style="width:'+pr+'%"></div></div><span class="muted sm">'+dc+'/'+tc+' ('+pr+'%)</span></div>';
  }).join("");
  var form=isManager()?'<div class="card"><h3>New Project</h3><form id="projectForm" class="form-stack"><input id="projName" placeholder="Project name" required/><textarea id="projDesc" placeholder="Description"></textarea><input id="projDeadline" type="date"/><button type="submit" class="btn primary">'+icon("plus")+' Create</button></form></div>':'';
  return shell('<div class="grid-2"><div class="project-grid">'+( list||'<p class="muted">No projects</p>')+'</div>'+form+'</div>');
}

/* ====== PERFORMANCE ====== */
function performancePage() {
  var p=state.perf;
  if(isManager()) {
    var lb=state.leaderboard.map(function(r,i){
      var medal=i===0?'<span class="gold">&#9733;</span>':i===1?'<span class="silver">&#9733;</span>':i===2?'<span class="bronze">&#9733;</span>':'';
      return'<tr><td>'+medal+' <strong>'+esc(r.name)+'</strong></td><td class="center">'+r.score+'</td><td class="center">'+r.completed+'/'+r.total_tasks+'</td><td class="center"><span class="text-red">'+r.overdue+'</span></td><td><div class="progress-bar"><div class="progress-fill" style="width:'+r.score+'%"></div></div></td></tr>';
    }).join("");
    return shell(
      '<div class="stats-row"><div class="stat-card clickable" onclick="popupPerfCard(\'score\')"><div class="stat-icon blue">'+icon("star")+'</div><div class="stat-body"><span class="stat-val">'+(p.productivity_score||0)+'</span><span class="stat-label">Team Score</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'week\')"><div class="stat-icon green">'+icon("check")+'</div><div class="stat-body"><span class="stat-val">'+(p.completed_this_week||0)+'</span><span class="stat-label">Done This Week</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'month\')"><div class="stat-icon amber">'+icon("tasks")+'</div><div class="stat-body"><span class="stat-val">'+(p.completed_this_month||0)+'</span><span class="stat-label">Done This Month</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'overdue\')"><div class="stat-icon red">'+icon("clock")+'</div><div class="stat-body"><span class="stat-val">'+(p.overdue_tasks||0)+'</span><span class="stat-label">Overdue</span></div></div></div>' +
      '<div class="card"><div class="card-header"><h3>Employee Leaderboard</h3>'+icon("trophy")+'</div><div class="table-wrap"><table><thead><tr><th>Employee</th><th class="center">Score</th><th class="center">Tasks</th><th class="center">Overdue</th><th>Progress</th></tr></thead><tbody>'+(lb||'<tr><td colspan="5" class="muted center">No data</td></tr>')+'</tbody></table></div></div>'
    );
  } else {
    return shell(
      '<div class="stats-row"><div class="stat-card clickable" onclick="popupPerfCard(\'score\')"><div class="stat-icon blue">'+icon("star")+'</div><div class="stat-body"><span class="stat-val">'+(p.productivity_score||0)+'</span><span class="stat-label">My Score</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'week\')"><div class="stat-icon green">'+icon("check")+'</div><div class="stat-body"><span class="stat-val">'+(p.completed_this_week||0)+'</span><span class="stat-label">Done This Week</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'month\')"><div class="stat-icon amber">'+icon("tasks")+'</div><div class="stat-body"><span class="stat-val">'+(p.completed_this_month||0)+'</span><span class="stat-label">Done This Month</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'overdue\')"><div class="stat-icon red">'+icon("clock")+'</div><div class="stat-body"><span class="stat-val">'+(p.overdue_tasks||0)+'</span><span class="stat-label">Overdue</span></div></div></div>' +
      '<div class="card"><h3>Average Work Hours: '+(p.avg_work_hours||0)+'h/day</h3></div>'
    );
  }
}

/* ====== CALENDAR ====== */
function calendarPage() {
  var mn=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var y=state.calYear,m=state.calMonth;
  var first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  var cells='';
  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(function(d){cells+='<div class="cal-head">'+d+'</div>';});
  for(var i=0;i<first;i++) cells+='<div class="cal-cell empty"></div>';
  for(var d=1;d<=days;d++){
    var dayTasks=state.calendarTasks.filter(function(t){return t.day===d;});
    var dots=dayTasks.slice(0,3).map(function(t){return'<div class="cal-dot '+esc(t.status)+'" title="'+esc(t.title)+'"></div>';}).join("");
    var isToday=(d===new Date().getDate()&&m===new Date().getMonth()&&y===new Date().getFullYear())?" today":"";
    cells+='<div class="cal-cell'+isToday+'"><span class="cal-day">'+d+'</span>'+dots+'</div>';
  }
  return shell(
    '<div class="cal-nav"><button class="btn-sm" onclick="calPrev()">&#8592; Prev</button><h3>'+mn[m]+' '+y+'</h3><button class="btn-sm" onclick="calNext()">Next &#8594;</button></div>' +
    '<div class="cal-grid">'+cells+'</div>' +
    '<div class="card" style="margin-top:20px"><h3>Tasks in '+mn[m]+'</h3><div class="activity-list">'+(state.calendarTasks.length>0?state.calendarTasks.map(function(t){
      return'<div class="activity-row clickable" onclick="viewTask('+t.id+')"><div class="activity-dot '+esc(t.status)+'"></div><div class="activity-body"><strong>'+esc(t.title)+'</strong><span class="muted">'+t.date+' &middot; '+badge(t.priority)+'</span></div>'+badge(t.status)+'</div>';
    }).join(""):'<p class="muted">No tasks this month</p>')+'</div></div>'
  );
}

/* ====== ATTENDANCE ====== */
function attendancePage() {
  if (isAdmin()) return adminAttendancePage();
  if (isManager()) return managerAttendancePage();

  var pt = state.punchToday || {logs:[], summary:{}};
  var logs = pt.logs || [];
  var sum = pt.summary || {};
  var canIn = !sum.status || sum.status === "checked_out" || sum.status === "absent";
  var canOut = sum.status === "working";

  // Punch buttons — open modal
  var btnHtml =
    '<div class="punch-buttons">' +
      '<button class="btn punch-in'+(canIn?"":" disabled")+'" onclick="showPunchModal(\'in\')"'+(canIn?'':' disabled')+'>' +
        icon("clock") + ' Punch In' +
      '</button>' +
      '<button class="btn punch-out'+(canOut?"":" disabled")+'" onclick="showPunchModal(\'out\')"'+(canOut?'':' disabled')+'>' +
        icon("logout") + ' Punch Out' +
      '</button>' +
    '</div>';

  // Status banner
  var statusHtml = '';
  if (sum.status === "working") {
    statusHtml = '<div class="att-active"><span class="pulse"></span> Currently working since ' + (sum.first_in ? fmtTime(sum.first_in) : '--:--') + '</div>';
  } else if (sum.status === "checked_out") {
    statusHtml = '<div class="att-done"><strong>Day complete</strong><p>' + sum.total_hours + 'h worked &middot; ' + sum.break_minutes + 'm break</p></div>';
  }
  if (sum.is_late) {
    statusHtml += '<div class="late-badge">Late arrival detected</div>';
  }

  // Summary cards — clickable to filter history
  var ecf = state._empAttCardFilter || "";
  var allHist = state.punchHistory || [];
  var totalDays = allHist.length;
  var lateDays = allHist.filter(function(d){return d.summary.is_late;}).length;
  var fullDays = allHist.filter(function(d){return d.summary.min_hours_met;}).length;
  var shortDays = allHist.filter(function(d){return d.summary.total_hours>0&&!d.summary.min_hours_met;}).length;

  var empCards = [
    {key:"all",    label:"Total Days",   val:totalDays, color:"blue"},
    {key:"full",   label:"Full Days",    val:fullDays,  color:"green"},
    {key:"short",  label:"Under Hours",  val:shortDays, color:"amber"},
    {key:"late",   label:"Late Days",    val:lateDays,  color:"red"}
  ];
  var sumHtml =
    '<div class="punch-summary">' +
      '<div class="punch-stat"><span class="punch-stat-val">' + (sum.total_hours || 0) + 'h</span><span>Work Hours</span></div>' +
      '<div class="punch-stat"><span class="punch-stat-val">' + (sum.break_minutes || 0) + 'm</span><span>Break Time</span></div>' +
      '<div class="punch-stat"><span class="punch-stat-val">' + (sum.first_in ? fmtTime(sum.first_in) : '--') + '</span><span>First In</span></div>' +
      '<div class="punch-stat"><span class="punch-stat-val">' + (sum.last_out ? fmtTime(sum.last_out) : '--') + '</span><span>Last Out</span></div>' +
    '</div>' +
    '<div class="emp-att-cards">' +
      empCards.map(function(c) {
        var active = ecf === c.key ? " att-card-active" : "";
        return '<div class="emp-att-card '+c.color+active+'" onclick="empAttCardClick(\''+c.key+'\')">' +
          '<span class="emp-att-card-val">'+c.val+'</span><span>'+c.label+'</span>' +
        '</div>';
      }).join("") +
    '</div>';

  // Timeline
  var timeline = logs.map(function(l, i) {
    var isIn = l.punch_type === "IN";
    var desc = l.description || (isIn ? "Checked in" : "Checked out");
    return '<div class="tl-item">' +
      '<div class="tl-time">' + fmtTime(l.timestamp) + '</div>' +
      '<div class="tl-dot ' + (isIn ? 'tl-in' : 'tl-out') + '"></div>' +
      '<div class="tl-content">' +
        '<div class="tl-header"><strong>' + (isIn ? 'Checked In' : 'Checked Out') + '</strong></div>' +
        '<p class="tl-desc">' + esc(desc) + '</p>' +
      '</div>' +
    '</div>';
  }).join("");

  // History — filtered by card selection
  var histData = allHist;
  var histLabel = "";
  if (ecf === "full") { histData = allHist.filter(function(d){return d.summary.min_hours_met;}); histLabel = "Full Days"; }
  else if (ecf === "short") { histData = allHist.filter(function(d){return d.summary.total_hours>0&&!d.summary.min_hours_met;}); histLabel = "Under Hours Days"; }
  else if (ecf === "late") { histData = allHist.filter(function(d){return d.summary.is_late;}); histLabel = "Late Days"; }

  var histShowingHtml = ecf ? '<div class="att-showing sm"><span>Showing: <strong>'+histLabel+'</strong> ('+histData.length+')</span><button class="btn-sm" onclick="empAttCardClick(\'\')">'+icon("close")+' Clear</button></div>' : '';

  var hist = histData.map(function(day) {
    var s = day.summary;
    var late = s.is_late ? ' <span class="late-badge sm">Late</span>' : '';
    var minMet = s.min_hours_met ? '' : (s.total_hours > 0 ? ' <span class="under-hours">Under ' + 8 + 'h</span>' : '');
    return '<div class="history-day">' +
      '<div class="history-day-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
        '<div><strong>' + new Date(day.date + "T00:00").toLocaleDateString("en-IN", {weekday:"short", day:"2-digit", month:"short"}) + '</strong>' + late + minMet + '</div>' +
        '<div class="history-day-stats"><span class="text-blue">' + s.total_hours + 'h</span><span class="muted">' + s.break_minutes + 'm break</span><span class="muted">' + day.logs.length + ' punches</span></div>' +
      '</div>' +
      '<div class="history-day-logs">' +
        day.logs.map(function(l) {
          return '<div class="history-log-row"><span class="badge ' + (l.punch_type === "IN" ? "completed" : "pending") + '">' + l.punch_type + '</span><span>' + fmtTime(l.timestamp) + '</span><span class="muted">' + esc(l.description || '') + '</span></div>';
        }).join("") +
      '</div>' +
    '</div>';
  }).join("");

  return shell(
    '<div class="grid-2">' +
      '<div class="card">' +
        '<h3>Punch In / Out</h3>' +
        statusHtml + btnHtml + sumHtml +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header"><h3>Today\'s Timeline</h3><span class="badge blue">' + logs.length + ' entries</span></div>' +
        '<div class="timeline">' + (timeline || '<p class="muted">No punches today</p>') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:20px">' +
      '<div class="card-header"><h3>Attendance History</h3></div>' +
      histShowingHtml +
      '<div class="history-list">' + (hist || '<p class="muted">No history</p>') + '</div>' +
    '</div>'
  );
}

function attStatusBadge(st) {
  var map = {pending:"pending",working:"in_progress",on_break:"medium",completed:"completed",late:"urgent",overtime:"high"};
  return '<span class="badge '+(map[st]||"pending")+'">'+esc(st.replace(/_/g," "))+'</span>';
}

/* ---- Shared team attendance table builder ---- */
function _buildTeamAttTable(title, showDeptCol) {
  var data = state.allAttendance || {};
  var stats = data.stats || {};
  var emps = data.employees || [];
  var cardFilter = state._attCardFilter || "";
  var searchVal = state._attSearch || "";
  var statusFilter = state._attStatusFilter || "";
  var filtered = emps;
  if (cardFilter) {
    if (cardFilter === "all") filtered = emps;
    else if (cardFilter === "present") filtered = emps.filter(function(a){return a.status!=="pending";});
    else if (cardFilter === "pending") filtered = emps.filter(function(a){return a.status==="pending";});
    else if (cardFilter === "on_break") filtered = emps.filter(function(a){return a.status==="on_break";});
    else if (cardFilter === "completed") filtered = emps.filter(function(a){return a.status==="completed"||a.status==="overtime";});
    else if (cardFilter === "late") filtered = emps.filter(function(a){return a.summary&&a.summary.is_late;});
    else if (cardFilter === "sort_hours") { filtered = emps.slice().sort(function(a,b){return(b.summary.total_hours||0)-(a.summary.total_hours||0);}); }
    else if (cardFilter === "sort_break") { filtered = emps.slice().sort(function(a,b){return(b.summary.break_minutes||0)-(a.summary.break_minutes||0);}); }
  }
  if (searchVal) filtered = filtered.filter(function(a){return a.name.toLowerCase().indexOf(searchVal.toLowerCase())>=0;});
  if (statusFilter) filtered = filtered.filter(function(a){return a.status===statusFilter;});

  var cardDefs = [
    {key:"all",label:"Total",val:stats.total_employees,icon:"people",color:"blue"},
    {key:"present",label:"Present",val:stats.present,icon:"check",color:"green"},
    {key:"pending",label:"Not In",val:stats.pending,icon:"clock",color:"amber"},
    {key:"on_break",label:"On Break",val:stats.on_break,icon:"clock",color:"purple"},
    {key:"completed",label:"Complete",val:stats.completed,icon:"check",color:"teal"},
    {key:"late",label:"Late",val:stats.late,icon:"bell",color:"red"},
    {key:"sort_hours",label:"Work Hours",val:stats.total_work_hours+"h",icon:"clock",color:"blue"},
    {key:"sort_break",label:"Break Time",val:stats.total_break_hours+"h",icon:"clock",color:"amber"}
  ];
  var statCards = '<div class="att-stats-grid">' + cardDefs.map(function(c) {
    var active = cardFilter === c.key ? " att-card-active" : "";
    var pk = {all:"all",present:"present",pending:"pending",on_break:"on_break",completed:"completed",late:"late",sort_hours:"hours",sort_break:"break"}[c.key]||c.key;
    return '<div class="att-stat-card'+active+'" onclick="attCardClick(\''+c.key+'\')">' +
      '<div class="att-stat-icon '+c.color+'">'+icon(c.icon)+'</div>' +
      '<div><span class="att-stat-val">'+c.val+'</span><span class="att-stat-label">'+c.label+'</span></div>' +
      '<button class="att-card-info" onclick="event.stopPropagation();popupAttCard(\''+pk+'\')" title="Details">'+icon("eye")+'</button>' +
    '</div>';
  }).join("") + '</div>';

  var showingLabel = "";
  if (cardFilter) {
    var ad = cardDefs.find(function(c){return c.key===cardFilter;});
    showingLabel = '<div class="att-showing"><span>Showing: <strong>'+(ad?ad.label:"All")+'</strong> ('+filtered.length+')</span><button class="btn-sm" onclick="attCardClick(\'\')">'+icon("close")+' Clear</button></div>';
  }

  var statusOpts = '<option value="">All Status</option>'+["pending","working","on_break","completed","late","overtime"].map(function(s){return '<option value="'+s+'"'+(statusFilter===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("");
  var filters = '<div class="att-filters"><input id="attSearch" placeholder="Search..." value="'+esc(searchVal)+'" onkeyup="state._attSearch=this.value;render()"/><select id="attStatusFilter" onchange="state._attStatusFilter=this.value;render()">'+statusOpts+'</select><button class="btn-sm" onclick="window.open(\'/api/export/attendance-csv\')">'+icon("download")+' CSV</button></div>';

  var deptTh = showDeptCol ? '<th>Dept</th><th>Reports To</th>' : '';
  var colSpan = showDeptCol ? 13 : 11;
  var rows = filtered.map(function(a) {
    var s = a.summary;
    var warnHtml = a.warnings.length > 0 ? '<div class="att-warn-dots">'+a.warnings.slice(0,2).map(function(w){return '<span class="att-warn-dot" title="'+esc(w)+'">!</span>';}).join("")+'</div>' : '';
    var deptTd = showDeptCol ? '<td class="muted sm">'+esc(a.department||"—")+'</td><td class="muted sm">'+esc(a.reporting_to||"—")+'</td>' : '';
    return '<tr class="att-emp-row" onclick="toggleAttDetail(\'attDetail_'+a.user_id+'\')">' +
      '<td><div class="emp-cell clickable" onclick="event.stopPropagation();popupEmpTimeline('+a.user_id+')"><div class="avatar-xs">'+initials(a.name)+'</div><div><strong>'+esc(a.name)+'</strong><span class="muted sm">'+esc(a.email)+'</span></div></div></td>' +
      '<td>'+badge(a.role)+'</td>'+deptTd+
      '<td>'+attStatusBadge(a.status)+warnHtml+'</td>' +
      '<td>'+(s.first_in?fmtTime(s.first_in):'<span class="muted">--</span>')+'</td><td>'+(s.last_out?fmtTime(s.last_out):'<span class="muted">--</span>')+'</td>' +
      '<td><strong>'+(s.total_hours||0)+'h</strong></td><td>'+(s.break_minutes||0)+'m</td><td class="center">'+a.punch_count+'</td>' +
      '<td class="muted sm">'+esc(a.last_description||"—")+'</td>' +
      '<td class="actions"><button class="btn-sm" onclick="event.stopPropagation();toggleAttDetail(\'attDetail_'+a.user_id+'\')">'+icon("eye")+'</button></td>' +
    '</tr><tr class="att-detail-row" id="attDetail_'+a.user_id+'" style="display:none"><td colspan="'+colSpan+'">'+renderAttDetail(a)+'</td></tr>';
  }).join("");

  return statCards + showingLabel +
    '<div class="card no-pad" style="margin-top:20px"><div class="att-table-header"><h3>'+title+' — '+(data.date||"Today")+'</h3>'+filters+'</div>' +
    '<div class="table-wrap"><table id="attTable"><thead><tr><th>Name</th><th>Role</th>'+deptTh+'<th>Status</th><th>First In</th><th>Last Out</th><th>Hours</th><th>Break</th><th class="center">Punches</th><th>Description</th><th>Actions</th></tr></thead>' +
    '<tbody>'+(rows||'<tr><td colspan="'+colSpan+'" class="muted center">No data</td></tr>')+'</tbody></table></div></div>';
}

/* ---- Shared "My Attendance" punch section builder ---- */
function _buildMyPunchSection() {
  var pt = state.punchToday || {logs:[], summary:{}};
  var logs = pt.logs || [];
  var sum = pt.summary || {};
  var canIn = !sum.status || sum.status === "checked_out" || sum.status === "absent";
  var canOut = sum.status === "working";

  var btnHtml = '<div class="punch-buttons">' +
    '<button class="btn punch-in'+(canIn?"":" disabled")+'" onclick="showPunchModal(\'in\')"'+(canIn?'':' disabled')+'>'+icon("clock")+' Punch In</button>' +
    '<button class="btn punch-out'+(canOut?"":" disabled")+'" onclick="showPunchModal(\'out\')"'+(canOut?'':' disabled')+'>'+icon("logout")+' Punch Out</button>' +
  '</div>';

  var statusHtml = '';
  if (sum.status === "working") statusHtml = '<div class="att-active"><span class="pulse"></span> Working since '+(sum.first_in?fmtTime(sum.first_in):'--:--')+'</div>';
  else if (sum.status === "checked_out") statusHtml = '<div class="att-done"><strong>Day complete</strong><p>'+sum.total_hours+'h worked &middot; '+sum.break_minutes+'m break</p></div>';

  var sumHtml = '<div class="punch-summary">' +
    '<div class="punch-stat"><span class="punch-stat-val">'+(sum.total_hours||0)+'h</span><span>Hours</span></div>' +
    '<div class="punch-stat"><span class="punch-stat-val">'+(sum.break_minutes||0)+'m</span><span>Break</span></div>' +
    '<div class="punch-stat"><span class="punch-stat-val">'+(sum.first_in?fmtTime(sum.first_in):'--')+'</span><span>In</span></div>' +
    '<div class="punch-stat"><span class="punch-stat-val">'+(sum.last_out?fmtTime(sum.last_out):'--')+'</span><span>Out</span></div>' +
  '</div>';

  var timeline = logs.map(function(l) {
    var isIn = l.punch_type === "IN";
    return '<div class="tl-item"><div class="tl-time">'+fmtTime(l.timestamp)+'</div><div class="tl-dot '+(isIn?'tl-in':'tl-out')+'"></div><div class="tl-content"><div class="tl-header"><strong>'+(isIn?'Checked In':'Checked Out')+'</strong></div><p class="tl-desc">'+esc(l.description||(isIn?"Checked in":"Checked out"))+'</p></div></div>';
  }).join("");

  return '<div class="grid-2">' +
    '<div class="card"><h3>My Attendance</h3>'+statusHtml+btnHtml+sumHtml+'</div>' +
    '<div class="card"><div class="card-header"><h3>Today\'s Timeline</h3><span class="badge blue">'+logs.length+'</span></div><div class="timeline">'+(timeline||'<p class="muted">No punches today</p>')+'</div></div>' +
  '</div>';
}

/* ---- Admin/Super Admin: full HRMS table ---- */
function adminAttendancePage() {
  return shell(_buildMyPunchSection() + _buildTeamAttTable("All Attendance", true));
}

/* ---- Manager: own punch + team table ---- */
function managerAttendancePage() {
  return shell(_buildMyPunchSection() + _buildTeamAttTable("Team Attendance", false));
}

function renderAttDetail(a) {
  var s = a.summary;
  var logs = a.logs || [];

  // Timeline
  var timeline = logs.map(function(l) {
    var isIn = l.punch_type === "IN";
    return '<div class="att-tl-item">' +
      '<div class="att-tl-time">'+fmtTime(l.timestamp)+'</div>' +
      '<div class="att-tl-dot '+(isIn?"tl-in":"tl-out")+'"></div>' +
      '<div class="att-tl-body">' +
        '<strong>'+(isIn?"Check In":"Check Out")+'</strong>' +
        '<span class="muted"> — '+esc(l.description||(isIn?"Checked in":"Checked out"))+'</span>' +
      '</div>' +
    '</div>';
  }).join("");

  if (!timeline) timeline = '<p class="muted sm">No punches recorded today</p>';

  // Summary row
  var lateBy = '';
  if (s.is_late && s.first_in) {
    var fi = new Date(s.first_in);
    var lateMin = Math.max(0, (fi.getHours() - 9) * 60 + fi.getMinutes());
    if (lateMin > 0) lateBy = '<div class="att-detail-stat warn"><span>Late By</span><strong>'+lateMin+'m</strong></div>';
  }
  var overtime = '';
  if (s.total_hours > 8) {
    overtime = '<div class="att-detail-stat good"><span>Overtime</span><strong>'+Math.round((s.total_hours-8)*60)+'m</strong></div>';
  }

  // Warnings
  var warnHtml = a.warnings.length > 0
    ? '<div class="att-warnings">' + a.warnings.map(function(w) {
        return '<div class="att-warning-item">'+icon("bell")+' '+esc(w)+'</div>';
      }).join("") + '</div>'
    : '';

  return '<div class="att-detail-panel">' +
    '<div class="att-detail-header"><strong>'+esc(a.name)+'</strong> — Activity Timeline</div>' +
    '<div class="att-detail-stats">' +
      '<div class="att-detail-stat"><span>Work Hours</span><strong>'+s.total_hours+'h</strong></div>' +
      '<div class="att-detail-stat"><span>Break Time</span><strong>'+s.break_minutes+'m</strong></div>' +
      '<div class="att-detail-stat"><span>First In</span><strong>'+(s.first_in?fmtTime(s.first_in):"—")+'</strong></div>' +
      '<div class="att-detail-stat"><span>Last Out</span><strong>'+(s.last_out?fmtTime(s.last_out):"—")+'</strong></div>' +
      lateBy + overtime +
    '</div>' +
    '<div class="att-detail-timeline">'+timeline+'</div>' +
    warnHtml +
  '</div>';
}

/* ====== LEAVE ====== */
function leavePage() {
  if (isManager()) return managerLeavePage();
  return employeeLeavePage();
}

function employeeLeavePage() {
  var bal = state.leaveBalance || {balances:[], summary:{}};
  var bals = bal.balances || [];
  var sum = bal.summary || {};

  // Balance cards
  var balCards = bals.map(function(b) {
    var pct = b.total > 0 ? Math.round((b.used/b.total)*100) : 0;
    var color = b.remaining <= 2 ? "red" : b.remaining <= 5 ? "amber" : "green";
    return '<div class="leave-bal-card clickable" onclick="popupLeaveBalance(\''+esc(b.leave_type)+'\')">' +
      '<div class="leave-bal-type">'+esc(b.leave_type)+'</div>' +
      '<div class="leave-bal-ring"><svg viewBox="0 0 36 36" class="ring"><path class="ring-bg" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/><path class="ring-fill leave-ring-'+color+'" stroke-dasharray="'+pct+',100" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/></svg><span class="ring-text sm">'+b.remaining+'</span></div>' +
      '<div class="leave-bal-meta"><span>'+b.used+' used</span><span>'+b.total+' total</span></div>' +
    '</div>';
  }).join("");

  // Summary cards
  var sumCards =
    '<div class="leave-sum-row">' +
      '<div class="leave-sum-card clickable" onclick="popupLeavesByStatus(\'all\')"><span class="leave-sum-val">'+(sum.total_requests||0)+'</span><span>Total</span></div>' +
      '<div class="leave-sum-card clickable" onclick="popupLeavesByStatus(\'pending\')"><span class="leave-sum-val text-amber">'+(sum.pending||0)+'</span><span>Pending</span></div>' +
      '<div class="leave-sum-card clickable" onclick="popupLeavesByStatus(\'approved\')"><span class="leave-sum-val text-green">'+(sum.approved||0)+'</span><span>Approved</span></div>' +
      '<div class="leave-sum-card clickable" onclick="popupLeavesByStatus(\'rejected\')"><span class="leave-sum-val text-red">'+(sum.rejected||0)+'</span><span>Rejected</span></div>' +
    '</div>';

  // History table
  var rows = (state.leaves||[]).map(function(l) {
    var emrg = l.is_emergency ? ' <span class="badge urgent">Emergency</span>' : '';
    var half = l.half_day ? ' <span class="badge medium">Half day</span>' : '';
    var cancelBtn = (l.status==="pending"||l.status==="approved") ? '<button class="btn-sm danger" onclick="cancelLeave('+l.id+')">'+icon("close")+' Cancel</button>' : '';
    return '<tr class="clickable" onclick="popupLeaveDetail('+l.id+')">' +
      '<td>'+esc(l.leave_type)+emrg+half+'</td>' +
      '<td>'+l.start_date+'</td><td>'+l.end_date+'</td>' +
      '<td>'+l.total_days+'d</td>' +
      '<td class="muted sm" style="max-width:200px">'+esc((l.reason||"").slice(0,50))+'</td>' +
      '<td>'+badge(l.status)+'</td>' +
      '<td class="muted sm">'+esc(l.manager_comment||"—")+'</td>' +
      '<td onclick="event.stopPropagation()">'+cancelBtn+'</td>' +
    '</tr>';
  }).join("");

  // Apply form
  var typeOpts = ["Paid Leave","Sick Leave","Casual Leave","Unpaid Leave"].map(function(t){return '<option>'+t+'</option>';}).join("");

  return shell(
    '<div class="leave-bal-grid">'+balCards+'</div>' +
    sumCards +
    '<div class="grid-2" style="margin-top:20px">' +
      '<div class="card no-pad">' +
        '<div class="att-table-header"><h3>My Leave History</h3></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Comment</th><th>Actions</th></tr></thead>' +
        '<tbody>'+(rows||'<tr><td colspan="8" class="muted center">No leave requests</td></tr>')+'</tbody></table></div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Apply for Leave</h3>' +
        '<form id="leaveForm" class="form-stack">' +
          '<label>Leave Type</label><select id="leaveType">'+typeOpts+'</select>' +
          '<div class="form-row"><div><label>Start Date</label><input id="leaveStart" type="date" required/></div><div><label>End Date</label><input id="leaveEnd" type="date" required/></div></div>' +
          '<div class="form-row"><div><label><input type="checkbox" id="leaveHalf" /> Half Day</label></div><div><label><input type="checkbox" id="leaveEmergency" /> Emergency</label></div></div>' +
          '<label>Reason</label><textarea id="leaveReason" placeholder="Reason for leave..." required></textarea>' +
          '<label>Contact During Leave</label><input id="leaveContact" placeholder="Phone / email (optional)" />' +
          '<div id="leaveError"></div>' +
          '<button type="submit" class="btn primary full">'+icon("send")+' Submit Request</button>' +
        '</form>' +
      '</div>' +
    '</div>'
  );
}

function managerLeavePage() {
  var dash = state.leaveDash || {};
  var leaves = state.leaves || [];
  var pending = dash.pending_requests || [];

  // Top stats
  var stats =
    '<div class="att-stats-grid">' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'total\')"><div class="att-stat-icon blue">'+icon("file")+'</div><div><span class="att-stat-val">'+(dash.total_requests||0)+'</span><span class="att-stat-label">Total Requests</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'pending\')"><div class="att-stat-icon amber">'+icon("clock")+'</div><div><span class="att-stat-val">'+(dash.pending||0)+'</span><span class="att-stat-label">Pending</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'approved_today\')"><div class="att-stat-icon green">'+icon("check")+'</div><div><span class="att-stat-val">'+(dash.approved_today||0)+'</span><span class="att-stat-label">Approved Today</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'rejected_today\')"><div class="att-stat-icon red">'+icon("close")+'</div><div><span class="att-stat-val">'+(dash.rejected_today||0)+'</span><span class="att-stat-label">Rejected Today</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'on_leave\')"><div class="att-stat-icon purple">'+icon("leaf")+'</div><div><span class="att-stat-val">'+(dash.on_leave_today||0)+'</span><span class="att-stat-label">On Leave Today</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'upcoming\')"><div class="att-stat-icon teal">'+icon("cal")+'</div><div><span class="att-stat-val">'+(dash.upcoming_week||0)+'</span><span class="att-stat-label">Upcoming (7d)</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupMgrLeave(\'conflicts\')"><div class="att-stat-icon red">'+icon("bell")+'</div><div><span class="att-stat-val">'+(dash.conflicts||0)+'</span><span class="att-stat-label">Conflicts</span></div></div>' +
    '</div>';

  // Pending approval cards
  var pendingCards = pending.length > 0 ? pending.map(function(p) {
    var emrg = p.is_emergency ? '<span class="badge urgent">Emergency</span> ' : '';
    return '<div class="leave-pending-card">' +
      '<div class="leave-pending-top"><div class="emp-cell"><div class="avatar-xs">'+initials(p.name)+'</div><strong>'+esc(p.name)+'</strong></div>'+emrg+badge("pending")+'</div>' +
      '<div class="leave-pending-body">' +
        '<div class="leave-pending-meta"><span>'+esc(p.leave_type)+'</span><span>'+p.start_date+' to '+p.end_date+'</span><span>'+p.total_days+'d</span></div>' +
        '<p class="muted sm">'+esc(p.reason)+'</p>' +
      '</div>' +
      '<div class="leave-pending-actions">' +
        '<button class="btn primary" onclick="actionLeave('+p.id+',\'approved\')">'+icon("check")+' Approve</button>' +
        '<button class="btn outline" onclick="actionLeaveWithComment('+p.id+')">'+icon("close")+' Reject</button>' +
      '</div>' +
    '</div>';
  }).join("") : '<p class="muted">No pending requests</p>';

  // All leaves table
  var rows = leaves.map(function(l) {
    var emrg = l.is_emergency ? ' <span class="badge urgent sm">!</span>' : '';
    var actions = l.status==="pending" ?
      '<button class="btn-sm" onclick="event.stopPropagation();actionLeave('+l.id+',\'approved\')">'+icon("check")+'</button><button class="btn-sm danger" onclick="event.stopPropagation();actionLeaveWithComment('+l.id+')">'+icon("close")+'</button>' : '';
    return '<tr class="clickable" onclick="popupLeaveDetail('+l.id+')">' +
      '<td><div class="emp-cell"><div class="avatar-xs">'+initials(getUserName(l.user_id))+'</div><strong>'+esc(getUserName(l.user_id))+'</strong></div></td>' +
      '<td>'+esc(l.leave_type)+emrg+'</td>' +
      '<td>'+l.start_date+'</td><td>'+l.end_date+'</td><td>'+l.total_days+'d</td>' +
      '<td>'+badge(l.status)+'</td>' +
      '<td class="muted sm">'+esc((l.reason||"").slice(0,40))+'</td>' +
      '<td class="actions" onclick="event.stopPropagation()">'+actions+'</td>' +
    '</tr>';
  }).join("");

  return shell(
    stats +
    '<div class="grid-2" style="margin-top:20px">' +
      '<div class="card"><div class="card-header"><h3>Pending Approvals</h3><span class="badge urgent">'+pending.length+'</span></div><div class="leave-pending-list">'+pendingCards+'</div></div>' +
      '<div class="card"><div class="card-header"><h3>On Leave Today</h3></div>' +
        '<div class="activity-list">'+ ((dash.on_leave_employees||[]).length>0 ? (dash.on_leave_employees||[]).map(function(e){
          return '<div class="activity-row"><div class="activity-dot completed"></div><div class="activity-body"><strong>'+esc(e.name)+'</strong><span class="muted">'+esc(e.leave_type)+' until '+e.end_date+'</span></div></div>';
        }).join("") : '<p class="muted">No one on leave today</p>') +'</div>' +
      '</div>' +
    '</div>' +
    '<div class="card no-pad" style="margin-top:20px">' +
      '<div class="att-table-header"><h3>All Leave Requests</h3><button class="btn-sm" onclick="window.open(\'/api/export/tasks-csv\')">'+icon("download")+' Export</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>' +
      '<tbody>'+(rows||'<tr><td colspan="8" class="muted center">No requests</td></tr>')+'</tbody></table></div>' +
    '</div>'
  );
}

/* ====== EMPLOYEE DASHBOARD ====== */
function employeeDashboard() {
  var s=state.summary,p=state.perf,cp=pct(s.completed,s.total_tasks);
  var todayTasks=state.tasks.filter(function(t){if(!t.deadline)return false;return new Date(t.deadline).toDateString()===new Date().toDateString()&&t.status!=="completed";});
  var todayHtml=todayTasks.length>0?todayTasks.map(function(t){return'<div class="today-task" onclick="viewTask('+t.id+')"><div><strong>'+esc(t.title)+'</strong></div><div>'+badge(t.priority)+' '+badge(t.status)+'</div></div>';}).join(""):'<p class="muted">No tasks due today</p>';
  var recent=state.tasks.slice(0,5).map(function(t){return'<div class="activity-row clickable" onclick="viewTask('+t.id+')"><div class="activity-dot '+esc(t.status)+'"></div><div class="activity-body"><strong>'+esc(t.title)+'</strong><span class="muted">'+daysLeft(t.deadline)+'</span></div>'+badge(t.status)+'</div>';}).join("");
  var ptSum=(state.punchToday&&state.punchToday.summary)||{};
  var attStatus=ptSum.status==="working"?'<span class="text-blue">Working since '+fmtTime(ptSum.first_in)+'</span>':
    ptSum.status==="checked_out"?'<span class="text-green">Done ('+ptSum.total_hours+'h)</span>':
    '<span class="text-amber">Not punched in</span>';
  return shell(
    '<div class="welcome-banner"><div><h2>Welcome, '+esc(state.user.full_name.split(" ")[0])+'</h2><p class="muted">'+attStatus+'</p></div><div class="completion-ring"><svg viewBox="0 0 36 36" class="ring"><path class="ring-bg" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/><path class="ring-fill" stroke-dasharray="'+cp+',100" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/></svg><span class="ring-text">'+cp+'%</span></div></div>' +
    '<div class="stats-row">' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'total\')"><div class="stat-icon blue">'+icon("tasks")+'</div><div class="stat-body"><span class="stat-val">'+(s.total_tasks||0)+'</span><span class="stat-label">My Tasks</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'pending\')"><div class="stat-icon amber">'+icon("clock")+'</div><div class="stat-body"><span class="stat-val">'+(s.pending||0)+'</span><span class="stat-label">Pending</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupPerfCard(\'score\')"><div class="stat-icon blue">'+icon("star")+'</div><div class="stat-body"><span class="stat-val">'+(p.productivity_score||0)+'</span><span class="stat-label">Score</span></div></div>' +
      '<div class="stat-card clickable" onclick="popupDashCard(\'completed\')"><div class="stat-icon green">'+icon("check")+'</div><div class="stat-body"><span class="stat-val">'+(s.completed||0)+'</span><span class="stat-label">Completed</span></div></div>' +
    '</div>' +
    '<div class="quick-widgets">' +
      '<div class="qw"><span class="qw-val anim-count">'+(s.in_progress||0)+'</span><span>Active Now</span><span class="live-dot"></span></div>' +
      '<div class="qw"><span class="qw-val">'+(ptSum.total_hours||0)+'h</span><span>Tracked Today</span></div>' +
      '<div class="qw"><span class="qw-val">'+(state.tasks.filter(function(t){return t.status==="completed"&&new Date(t.updated_at).toDateString()===new Date().toDateString();}).length)+'</span><span>Done Today</span></div>' +
    '</div>' +
    '<div class="grid-2"><div class="card"><div class="card-header"><h3>Due Today</h3><span class="badge urgent">'+todayTasks.length+'</span></div><div class="today-list">'+todayHtml+'</div></div>' +
    '<div class="card"><div class="card-header"><h3>Recent Tasks</h3></div><div class="activity-list">'+(recent||'<p class="muted">No tasks</p>')+'</div></div></div>'
  );
}

/* ====== EMPLOYEE TASKS ====== */
function employeeTasks() {
  var stO='<option value="">All</option>'+["pending","in_progress","under_review","completed","blocked"].map(function(s){return'<option value="'+s+'"'+(state.filters.status===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("");
  var prO='<option value="">All</option>'+["low","medium","high","urgent"].map(function(p){return'<option value="'+p+'"'+(state.filters.priority===p?" selected":"")+'>'+p+'</option>';}).join("");
  var ft=state.tasks.filter(function(t){if(state.filters.status&&t.status!==state.filters.status)return false;if(state.filters.priority&&t.priority!==state.filters.priority)return false;return true;});
  var cards=ft.map(function(t){
    var sts=["pending","in_progress","under_review","completed","blocked"].map(function(s){return'<option value="'+s+'"'+(t.status===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("");
    var fb=t.rejection_feedback?'<div class="rejection-feedback">Feedback: '+esc(t.rejection_feedback)+'</div>':'';
    return'<div class="task-card" onclick="viewTask('+t.id+')"><div class="task-card-top"><div>'+badge(t.priority)+' '+badge(t.status)+'</div>'+daysLeft(t.deadline)+'</div><h4>'+esc(t.title)+'</h4><p class="muted sm">'+esc((t.description||"").slice(0,80))+'</p>'+fb+'<div class="task-card-footer"><span class="muted sm">'+fmtDate(t.deadline)+'</span><select class="status-select" onchange="event.stopPropagation();quickStatus('+t.id+',this.value)">'+sts+'</select></div></div>';
  }).join("");
  return shell('<div class="page-toolbar"><div class="filter-bar">'+icon("filter")+'<select id="filterStatus" onchange="applyFilters()">'+stO+'</select><select id="filterPrio" onchange="applyFilters()">'+prO+'</select><input id="taskSearch" placeholder="Search..." onkeyup="filterTaskSearch()"/></div></div><div class="task-grid" id="taskGrid">'+(cards||'<p class="muted">No tasks</p>')+'</div>');
}

/* ====== DAILY UPDATE ====== */
function dailyPage() {
  var updates=state.updates.map(function(u){
    var un=isManager()&&u.user_id?'<strong>'+esc(getUserName(u.user_id))+'</strong> &middot; ':'';
    var pr=u.pending_reason?'<div class="update-section"><span class="update-label blocked">Pending Reason</span><p>'+esc(u.pending_reason)+'</p></div>':'';
    return'<div class="update-card"><div class="update-meta">'+un+'<span class="muted">'+fmtDateTime(u.created_at)+'</span></div><div class="update-section"><span class="update-label completed">Completed</span><p>'+esc(u.completed_work)+'</p></div><div class="update-section"><span class="update-label pending">Pending</span><p>'+esc(u.pending_work||"None")+'</p></div><div class="update-section"><span class="update-label blocked">Blockers</span><p>'+esc(u.blockers||"None")+'</p></div>'+pr+'</div>';
  }).join("");
  return shell('<div class="grid-2"><div class="card"><h3>Submit Daily Report</h3><form id="dailyForm" class="form-stack"><label>Completed Work</label><textarea id="completedWork" placeholder="What did you complete?" required></textarea><label>Pending Work</label><textarea id="pendingWork" placeholder="What is pending?"></textarea><label>Pending Reason</label><textarea id="pendingReason" placeholder="Why are tasks pending?"></textarea><label>Blockers</label><textarea id="blockers" placeholder="Any blockers?"></textarea><button type="submit" class="btn primary">'+icon("send")+' Submit</button></form></div><div class="card"><h3>'+(isManager()?"All Reports":"My Reports")+'</h3><div class="updates-list">'+(updates||'<p class="muted">No reports</p>')+'</div></div></div>');
}

/* ====== NOTIFICATIONS ====== */
function notificationsPage() {
  var list=state.notifications.map(function(n){
    return'<div class="notif-item'+(n.is_read?"":" unread")+'"><div class="notif-icon">'+icon("bell")+'</div><div class="notif-body"><strong>'+esc(n.title)+'</strong><p>'+esc(n.message)+'</p><span class="muted sm">'+fmtDateTime(n.created_at)+'</span></div>'+(n.is_read?'<span class="badge completed">Read</span>':'<button class="btn-sm" onclick="markRead('+n.id+')">Mark read</button>')+'</div>';
  }).join("");
  return shell('<div class="card"><div class="card-header"><h3>Notifications</h3></div><div class="notif-list">'+(list||'<p class="muted">No notifications</p>')+'</div></div>');
}

/* ====== TASK DETAIL MODAL ====== */
function renderTaskModal(task) {
  if(!task)return;
  var an=getUserName(task.assigned_to_id),cn=getUserName(task.created_by_id);
  var cmts=state.taskComments.map(function(c){
    var nm=getUserName(c.user_id);
    return'<div class="comment"><div class="comment-head"><div class="avatar-xs">'+initials(nm)+'</div><strong>'+esc(nm)+'</strong><span class="muted sm">'+fmtDateTime(c.created_at)+'</span></div><p>'+esc(c.comment)+'</p></div>';
  }).join("");
  var sts='<select id="modalStatus" class="status-select">'+["pending","in_progress","under_review","completed","blocked"].map(function(s){return'<option value="'+s+'"'+(task.status===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("")+'</select>';
  var fb=task.rejection_feedback?'<div class="detail-item full"><span class="detail-label">Manager Feedback</span><div class="rejection-feedback">'+esc(task.rejection_feedback)+'</div></div>':'';
  var approvalBtns='';
  if(isManager()&&task.status==="under_review"){
    approvalBtns='<div class="approval-actions"><button class="btn primary" onclick="approveTask('+task.id+')">'+icon("check")+' Approve</button><button class="btn outline" onclick="showRejectModal('+task.id+')">'+icon("close")+' Reject</button></div>';
  }
  var fileUpload='<div class="file-section"><h4>'+icon("file")+' Attachments</h4><div id="fileList">Loading...</div><form id="uploadForm" class="upload-form"><input type="file" id="fileInput" /><button type="submit" class="btn-sm">'+icon("upload")+' Upload</button></form></div>';

  var modal=document.createElement("div");modal.className="modal-overlay";modal.id="taskModal";
  modal.innerHTML='<div class="modal"><div class="modal-header"><h2>'+esc(task.title)+'</h2><button class="btn-icon" onclick="closeModal()">'+icon("close")+'</button></div><div class="modal-body">' +
    '<div class="detail-grid"><div class="detail-item"><span class="detail-label">Status</span>'+sts+'</div><div class="detail-item"><span class="detail-label">Priority</span>'+badge(task.priority)+'</div><div class="detail-item"><span class="detail-label">Deadline</span><span>'+fmtDate(task.deadline)+' '+daysLeft(task.deadline)+'</span></div><div class="detail-item"><span class="detail-label">Assigned To</span><span>'+esc(an)+'</span></div><div class="detail-item"><span class="detail-label">Assigned By</span><span>'+esc(cn)+'</span></div><div class="detail-item"><span class="detail-label">Created</span><span>'+fmtDateTime(task.created_at)+'</span></div>'+fb+'</div>' +
    '<div class="detail-desc"><span class="detail-label">Description</span><p>'+esc(task.description||"No description")+'</p></div>' +
    approvalBtns +
    '<button class="btn primary" onclick="updateModalStatus('+task.id+')">Update Status</button>' +
    fileUpload +
    '<div class="comments-section"><h3>Comments &amp; Progress Notes</h3><div class="comments-list">'+(cmts||'<p class="muted">No comments</p>')+'</div><form id="commentForm" class="comment-form"><textarea id="commentText" placeholder="Add comment..." required></textarea><button type="submit" class="btn primary">'+icon("send")+' Post</button></form></div></div></div>';
  document.body.appendChild(modal);
  setTimeout(function(){modal.classList.add("active");},10);
  loadTaskFiles(task.id);
  $("commentForm").addEventListener("submit",async function(e){e.preventDefault();var t=$("commentText").value;if(!t.trim())return;await api("/tasks/"+task.id+"/comments/",{method:"POST",body:JSON.stringify({comment:t})});await loadComments(task.id);closeModal();renderTaskModal(task);});
  $("uploadForm").addEventListener("submit",async function(e){e.preventDefault();var f=$("fileInput").files[0];if(!f)return;var fd=new FormData();fd.append("file",f);await fetch(API+"/files/task/"+task.id,{method:"POST",headers:{Authorization:"Bearer "+token()},body:fd});loadTaskFiles(task.id);$("fileInput").value="";});
}
async function loadTaskFiles(taskId){
  try{var files=await api("/files/task/"+taskId);
    var fl=$("fileList");if(!fl)return;
    fl.innerHTML=files.length>0?files.map(function(f){return'<div class="file-row"><span>'+icon("file")+' '+esc(f.filename)+' <span class="muted sm">('+fileSize(f.file_size)+')</span></span><div><a class="btn-sm" href="/api/files/download/'+f.id+'" target="_blank">'+icon("download")+'</a>'+(f.user_id===state.user.id||isManager()?'<button class="btn-sm danger" onclick="deleteFile('+f.id+','+taskId+')">'+icon("trash")+'</button>':'')+'</div></div>';}).join(""):'<p class="muted sm">No files attached</p>';
  }catch(e){var fl2=$("fileList");if(fl2)fl2.innerHTML='<p class="muted sm">No files</p>';}
}

/* ====== CREATE/EDIT TASK MODAL ====== */
function renderCreateTaskModal(et) {
  var emps=state.users.filter(function(u){return u.role==="employee";});
  var isE=!!et;var t=et||{};
  var eO=emps.map(function(u){return'<option value="'+u.id+'"'+(t.assigned_to_id==u.id?" selected":"")+'>'+esc(u.full_name)+'</option>';}).join("");
  var pO='<option value="">No project</option>'+state.projects.map(function(p){return'<option value="'+p.id+'"'+(t.project_id==p.id?" selected":"")+'>'+esc(p.name)+'</option>';}).join("");
  var prS=["low","medium","high","urgent"].map(function(p){return'<option value="'+p+'"'+(t.priority===p?" selected":"")+'>'+p+'</option>';}).join("");
  var stS=isE?'<div><label>Status</label><select id="crudStatus">'+["pending","in_progress","under_review","completed","blocked"].map(function(s){return'<option value="'+s+'"'+(t.status===s?" selected":"")+'>'+s.replace(/_/g," ")+'</option>';}).join("")+'</select></div>':'';
  var dl=t.deadline?new Date(t.deadline).toISOString().split("T")[0]:"";
  var modal=document.createElement("div");modal.className="modal-overlay";modal.id="taskModal";
  modal.innerHTML='<div class="modal"><div class="modal-header"><h2>'+(isE?"Edit Task":"New Task")+'</h2><button class="btn-icon" onclick="closeModal()">'+icon("close")+'</button></div><div class="modal-body"><form id="taskCrudForm" class="form-stack"><label>Title</label><input id="crudTitle" value="'+esc(t.title||"")+'" required/><label>Description</label><textarea id="crudDesc">'+esc(t.description||"")+'</textarea><div class="form-row"><div><label>Assign To</label><select id="crudAssignee" required>'+eO+'</select></div><div><label>Priority</label><select id="crudPriority">'+prS+'</select></div></div><div class="form-row"><div><label>Project</label><select id="crudProject">'+pO+'</select></div><div><label>Deadline</label><input id="crudDeadline" type="date" value="'+dl+'"/></div></div>'+stS+'<button type="submit" class="btn primary full">'+(isE?"Update":"Create")+'</button></form></div></div>';
  document.body.appendChild(modal);setTimeout(function(){modal.classList.add("active");},10);
  $("taskCrudForm").addEventListener("submit",async function(e){e.preventDefault();var py={title:$("crudTitle").value,description:$("crudDesc").value,assigned_to_id:Number($("crudAssignee").value),priority:$("crudPriority").value,project_id:$("crudProject").value?Number($("crudProject").value):null,deadline:$("crudDeadline").value?new Date($("crudDeadline").value).toISOString():null};if(isE){py.status=$("crudStatus").value;await api("/tasks/"+t.id,{method:"PUT",body:JSON.stringify(py)});}else{await api("/tasks/",{method:"POST",body:JSON.stringify(py)});}closeModal();await load();render();});
}

/* ====== ADD EMPLOYEE MODAL ====== */
function renderAddEmployeeModal(editUser) {
  var isEdit = !!editUser;
  var u = editUser || {};
  var roles = ["employee","manager"];
  if (isAdmin()) roles.push("admin");
  var rO = roles.map(function(r){return'<option value="'+r+'"'+(u.role===r?" selected":"")+'>'+r+'</option>';}).join("");
  var depts = ["Engineering","Product","Design","QA","DevOps","HR","Marketing","Sales","Support","Finance"];
  var dO = '<option value="">Select Department</option>' + depts.map(function(d){return'<option'+(u.department===d?" selected":"")+'>'+d+'</option>';}).join("");
  var managers = state.users.filter(function(x){return x.role==="manager"||x.role==="admin"||x.role==="super_admin";});
  var mO = '<option value="">None (Direct)</option>' + managers.map(function(m){return'<option value="'+m.id+'"'+(u.reporting_to_id==m.id?" selected":"")+'>'+esc(m.full_name)+' ('+m.role+')</option>';}).join("");

  var modal = document.createElement("div"); modal.className="modal-overlay"; modal.id="taskModal";
  modal.innerHTML =
    '<div class="modal"><div class="modal-header"><h2>'+(isEdit?"Edit User":"Create New User")+'</h2><button class="btn-icon" onclick="closeModal()">'+icon("close")+'</button></div>' +
    '<div class="modal-body"><form id="addEmpForm" class="form-stack">' +
      '<label>Full Name</label><input id="empName" value="'+esc(u.full_name||"")+'" required />' +
      '<label>Email Address</label><input id="empEmail" type="email" value="'+esc(u.email||"")+'" '+(isEdit?"disabled":"")+' required />' +
      (isEdit ? '' : '<label>Password</label><input id="empPassword" type="password" placeholder="Set initial password" required />') +
      '<div class="form-row"><div><label>Role</label><select id="empRole">'+rO+'</select></div><div><label>Department</label><select id="empDept">'+dO+'</select></div></div>' +
      '<label>Reporting To</label><select id="empReporting">'+mO+'</select>' +
      '<div id="empError"></div>' +
      '<button type="submit" class="btn primary full">'+icon(isEdit?"check":"plus")+' '+(isEdit?"Update User":"Create User")+'</button>' +
    '</form></div></div>';

  document.body.appendChild(modal); setTimeout(function(){modal.classList.add("active");},10);
  $("addEmpForm").addEventListener("submit", async function(e) {
    e.preventDefault(); $("empError").innerHTML = "";
    try {
      if (isEdit) {
        await api("/users/"+u.id, {method:"PUT", body:JSON.stringify({
          full_name:$("empName").value, role:$("empRole").value,
          department:$("empDept").value||null, reporting_to_id:$("empReporting").value?Number($("empReporting").value):null
        })});
      } else {
        await api("/users/", {method:"POST", body:JSON.stringify({
          full_name:$("empName").value, email:$("empEmail").value, password:$("empPassword").value,
          role:$("empRole").value, department:$("empDept").value||null,
          reporting_to_id:$("empReporting").value?Number($("empReporting").value):null
        })});
      }
      closeModal(); await load(); render();
    } catch(err) { $("empError").innerHTML='<div class="error">'+esc(err.message)+'</div>'; }
  });
}

/* ====== USER MANAGEMENT PAGE ====== */
function userManagementPage() {
  if (!isAdmin()) return shell('<p class="muted">Access denied. Admin only.</p>');

  var users = state.users || [];
  var totalUsers = users.length;
  var activeUsers = users.filter(function(u){return u.is_active;}).length;
  var admins = users.filter(function(u){return u.role==="admin"||u.role==="super_admin";}).length;
  var mgrs = users.filter(function(u){return u.role==="manager";}).length;
  var emps = users.filter(function(u){return u.role==="employee";}).length;
  var depts = {};
  users.forEach(function(u){var d=u.department||"Unassigned";depts[d]=(depts[d]||0)+1;});

  // Stats
  var statsHtml =
    '<div class="att-stats-grid">' +
      '<div class="att-stat-card clickable" onclick="popupUsersByRole(\'all\')"><div class="att-stat-icon blue">'+icon("people")+'</div><div><span class="att-stat-val">'+totalUsers+'</span><span class="att-stat-label">Total Users</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupUsersByRole(\'active\')"><div class="att-stat-icon green">'+icon("check")+'</div><div><span class="att-stat-val">'+activeUsers+'</span><span class="att-stat-label">Active</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupUsersByRole(\'admin\')"><div class="att-stat-icon red">'+icon("star")+'</div><div><span class="att-stat-val">'+admins+'</span><span class="att-stat-label">Admins</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupUsersByRole(\'manager\')"><div class="att-stat-icon amber">'+icon("people")+'</div><div><span class="att-stat-val">'+mgrs+'</span><span class="att-stat-label">Managers</span></div></div>' +
      '<div class="att-stat-card clickable" onclick="popupUsersByRole(\'employee\')"><div class="att-stat-icon teal">'+icon("people")+'</div><div><span class="att-stat-val">'+emps+'</span><span class="att-stat-label">Employees</span></div></div>' +
      '<div class="att-stat-card"><div class="att-stat-icon purple">'+icon("folder")+'</div><div><span class="att-stat-val">'+Object.keys(depts).length+'</span><span class="att-stat-label">Departments</span></div></div>' +
    '</div>';

  // Table
  var rows = users.map(function(u) {
    var mgrName = "";
    if (u.reporting_to_id) {
      var mgr = users.find(function(x){return x.id===u.reporting_to_id;});
      mgrName = mgr ? mgr.full_name : "ID#"+u.reporting_to_id;
    }
    var statusBadge = u.is_active ? '<span class="badge completed">Active</span>' : '<span class="badge blocked">Inactive</span>';
    var actions = '';
    if (u.role !== "super_admin") {
      actions =
        '<button class="btn-sm" onclick="event.stopPropagation();editUserModal('+u.id+')" title="Edit">'+icon("edit")+'</button>' +
        '<button class="btn-sm" onclick="event.stopPropagation();resetUserPwd('+u.id+')" title="Reset Password">'+icon("clock")+'</button>' +
        (u.is_active ?
          '<button class="btn-sm danger" onclick="event.stopPropagation();deactivateUser('+u.id+')" title="Deactivate">'+icon("close")+'</button>' :
          '<button class="btn-sm" onclick="event.stopPropagation();activateUser('+u.id+')" title="Activate">'+icon("check")+'</button>');
    }

    return '<tr>' +
      '<td><div class="emp-cell"><div class="avatar-xs">'+initials(u.full_name)+'</div><div><strong>'+esc(u.full_name)+'</strong><span class="muted sm">'+esc(u.email)+'</span></div></div></td>' +
      '<td>'+badge(u.role)+'</td>' +
      '<td>'+esc(u.department||"—")+'</td>' +
      '<td>'+esc(mgrName||"—")+'</td>' +
      '<td>'+statusBadge+'</td>' +
      '<td class="muted sm">'+fmtDate(u.created_at)+'</td>' +
      '<td class="actions">'+actions+'</td>' +
    '</tr>';
  }).join("");

  return shell(
    statsHtml +
    '<div class="card no-pad" style="margin-top:20px">' +
      '<div class="att-table-header">' +
        '<h3>All Users</h3>' +
        '<div class="att-filters">' +
          '<input placeholder="Search users..." onkeyup="filterUserTable(this.value)" />' +
          '<button class="btn primary" onclick="showAddEmployee()">'+icon("plus")+' Create User</button>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap"><table id="userTable"><thead><tr><th>User</th><th>Role</th><th>Department</th><th>Reports To</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>' +
      '<tbody>'+(rows||'<tr><td colspan="7" class="muted center">No users</td></tr>')+'</tbody></table></div>' +
    '</div>'
  );
}

/* ====== RENDER ====== */
function render() {
  if(!token()||!state.user)return renderLogin();
  var pages;
  if(isManager()){pages={dashboard:managerDashboard,tasks:managerTasks,employees:managerEmployees,usermgmt:userManagementPage,projects:projectsPage,calendar:calendarPage,performance:performancePage,attendance:attendancePage,leave:leavePage,daily:dailyPage,notifications:notificationsPage};}
  else{pages={dashboard:employeeDashboard,tasks:employeeTasks,calendar:calendarPage,attendance:attendancePage,leave:leavePage,daily:dailyPage,notifications:notificationsPage};}
  if(state.page==="calendar")loadCalendar().then(function(){appEl.innerHTML=(pages[state.page]||pages.dashboard)();attachEvents();});
  else{appEl.innerHTML=(pages[state.page]||pages.dashboard)();attachEvents();}
}
function attachEvents() {
  var pf=$("projectForm");if(pf)pf.addEventListener("submit",async function(e){e.preventDefault();await api("/projects/",{method:"POST",body:JSON.stringify({name:$("projName").value,description:$("projDesc").value,deadline:$("projDeadline").value?new Date($("projDeadline").value).toISOString():null})});await load();render();});
  var df=$("dailyForm");if(df)df.addEventListener("submit",async function(e){e.preventDefault();await api("/daily-updates/",{method:"POST",body:JSON.stringify({completed_work:$("completedWork").value,pending_work:$("pendingWork").value,blockers:$("blockers").value,pending_reason:$("pendingReason")?$("pendingReason").value:null})});await load();render();});
  var lf=$("leaveForm");if(lf)lf.addEventListener("submit",async function(e){
    e.preventDefault();$("leaveError").innerHTML="";
    try{await api("/leave/",{method:"POST",body:JSON.stringify({
      leave_type:$("leaveType").value,start_date:$("leaveStart").value,end_date:$("leaveEnd").value,
      half_day:$("leaveHalf").checked?1:0,is_emergency:$("leaveEmergency").checked?1:0,
      reason:$("leaveReason").value,contact_during_leave:$("leaveContact").value||null
    })});await load();render();}catch(err){$("leaveError").innerHTML='<div class="error">'+esc(err.message)+'</div>';}
  });
}

/* ====== GLOBALS ====== */
window.go=function(p){state.page=p;var sb=$("sidebar");if(sb)sb.classList.remove("open");document.body.classList.remove("sidebar-open");render();};
window.toggleSidebar=function(){var sb=$("sidebar");if(sb){sb.classList.toggle("open");document.body.classList.toggle("sidebar-open");}};
window.logout=function(){clearToken();state.user=null;state.filters={employee:"",status:"",priority:""};renderLogin();};
window.applyFilters=function(){var e=$("filterEmp");state.filters.employee=e?e.value:"";state.filters.status=$("filterStatus")?$("filterStatus").value:"";state.filters.priority=$("filterPrio")?$("filterPrio").value:"";render();};
window.filterTaskSearch=function(){var el=$("taskSearch");if(!el)return;var q=el.value.toLowerCase();if($("taskTable"))document.querySelectorAll("#taskTable tbody tr").forEach(function(r){r.style.display=r.innerText.toLowerCase().indexOf(q)>=0?"":"none";});if($("taskGrid"))document.querySelectorAll("#taskGrid .task-card").forEach(function(c){c.style.display=c.innerText.toLowerCase().indexOf(q)>=0?"":"none";});};
window.viewTask=async function(id){var t=state.tasks.find(function(x){return x.id===id;});if(!t){try{t=await api("/tasks/"+id);}catch(e){return;}}state.selectedTask=t;await loadComments(id);renderTaskModal(t);};
window.editTask=function(id){var t=state.tasks.find(function(x){return x.id===id;});if(t&&isManager())renderCreateTaskModal(t);};
window.showCreateTask=function(){renderCreateTaskModal(null);};
window.showAddEmployee=function(){renderAddEmployeeModal(null);};
window.editUserModal=function(id){var u=state.users.find(function(x){return x.id===id;});if(u)renderAddEmployeeModal(u);};
window.deactivateUser=async function(id){if(!confirm("Deactivate this user?"))return;await api("/users/"+id,{method:"DELETE"});await load();render();};
window.activateUser=async function(id){await api("/users/"+id+"/activate",{method:"PUT"});await load();render();};
window.resetUserPwd=async function(id){if(!confirm("Reset password to Welcome@123?"))return;try{var r=await api("/users/"+id+"/reset-password",{method:"PUT"});alert("Password reset to: "+r.temp_password);}catch(e){alert(e.message);}};
window.filterUserTable=function(q){q=q.toLowerCase();document.querySelectorAll("#userTable tbody tr").forEach(function(r){r.style.display=r.innerText.toLowerCase().indexOf(q)>=0?"":"none";});};
window.popupUsersByRole=function(role){
  var users=state.users||[];
  if(role==="active")users=users.filter(function(u){return u.is_active;});
  else if(role!=="all")users=users.filter(function(u){return u.role===role||u.role==="super_admin"&&role==="admin";});
  var rows=users.map(function(u){return['<strong>'+esc(u.full_name)+'</strong>',esc(u.email),badge(u.role),esc(u.department||"—")];});
  showInfoPopup((role==="all"?"All":role.charAt(0).toUpperCase()+role.slice(1))+" Users",rows,["Name","Email","Role","Department"]);
};
window.deleteTask=async function(id){if(!confirm("Delete this task?"))return;await api("/tasks/"+id,{method:"DELETE"});await load();render();};
window.quickStatus=async function(id,s){await api("/tasks/"+id,{method:"PUT",body:JSON.stringify({status:s})});await load();render();};
window.updateModalStatus=async function(id){await api("/tasks/"+id,{method:"PUT",body:JSON.stringify({status:$("modalStatus").value})});closeModal();await load();render();};
window.markRead=async function(id){await api("/notifications/"+id+"/read",{method:"PUT"});await load();render();};
window.closeModal=function(){var m=$("taskModal");if(m){m.classList.remove("active");setTimeout(function(){m.remove();},200);}};
window.showPunchModal=function(type){
  var isIn = type === "in";
  var title = isIn ? "Punch In" : "Punch Out";
  var suggestions = isIn
    ? ["Start work", "Back from lunch", "Back from break", "Back from meeting"]
    : ["Lunch break", "Short break", "Meeting", "Day end"];
  var sugHtml = suggestions.map(function(s) {
    return '<button type="button" class="punch-sug" onclick="document.getElementById(\'punchDescInput\').value=\''+s+'\'">'+esc(s)+'</button>';
  }).join("");
  var iconColor = isIn ? "punch-in" : "punch-out";

  var modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "taskModal";
  modal.innerHTML =
    '<div class="modal punch-modal">' +
      '<div class="modal-header">' +
        '<h2>' + icon(isIn ? "clock" : "logout") + ' ' + title + '</h2>' +
        '<button class="btn-icon" onclick="closeModal()">' + icon("close") + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="punch-modal-icon ' + iconColor + '">' + (isIn ? icon("clock") : icon("logout")) + '</div>' +
        '<p class="punch-modal-time">' + new Date().toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit", second:"2-digit"}) + '</p>' +
        '<form id="punchForm" class="form-stack">' +
          '<label>Description <span class="muted sm">(optional)</span></label>' +
          '<input id="punchDescInput" placeholder="e.g. Lunch break, Day end, Back from meeting..." maxlength="255" />' +
          '<div class="punch-suggestions">' + sugHtml + '</div>' +
          '<div id="punchError"></div>' +
          '<button type="submit" class="btn ' + iconColor + ' full">' + icon(isIn ? "check" : "logout") + ' Confirm ' + title + '</button>' +
        '</form>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function(){ modal.classList.add("active"); }, 10);

  // Live clock update
  var clockInterval = setInterval(function() {
    var timeEl = modal.querySelector(".punch-modal-time");
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});
    else clearInterval(clockInterval);
  }, 1000);

  $("punchForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    $("punchError").innerHTML = "";
    var desc = $("punchDescInput").value.trim();
    var url = isIn ? "/attendance/punch-in" : "/attendance/punch-out";
    try {
      await api(url, {method: "POST", body: JSON.stringify({description: desc || null})});
      clearInterval(clockInterval);
      closeModal();
      await load();
      render();
    } catch(err) {
      $("punchError").innerHTML = '<div class="error">' + esc(err.message) + '</div>';
    }
  });
};
window.actionLeave=async function(id,s){await api("/leave/"+id,{method:"PUT",body:JSON.stringify({status:s,manager_comment:null})});await load();render();};
window.actionLeaveWithComment=async function(id){var c=prompt("Rejection reason / comment:");if(c===null)return;await api("/leave/"+id,{method:"PUT",body:JSON.stringify({status:"rejected",manager_comment:c})});await load();render();};
window.cancelLeave=async function(id){if(!confirm("Cancel this leave request?"))return;try{await api("/leave/"+id+"/cancel",{method:"PUT"});await load();render();}catch(e){alert(e.message);}};
window.popupLeaveBalance=function(type){
  var leaves=(state.leaves||[]).filter(function(l){return l.leave_type===type;});
  var rows=leaves.map(function(l){return[l.start_date+' to '+l.end_date,''+l.total_days+'d',badge(l.status),esc(l.reason||"").slice(0,40)];});
  showInfoPopup(type+" History",rows,["Dates","Days","Status","Reason"]);
};
window.popupLeavesByStatus=function(st){
  var leaves=state.leaves||[];
  if(st!=="all")leaves=leaves.filter(function(l){return l.status===st;});
  var rows=leaves.map(function(l){return[esc(l.leave_type),l.start_date+' to '+l.end_date,''+l.total_days+'d',badge(l.status)];});
  showInfoPopup(st==="all"?"All Requests":st.charAt(0).toUpperCase()+st.slice(1)+" Requests",rows,["Type","Dates","Days","Status"]);
};
window.popupLeaveDetail=function(id){
  var l=(state.leaves||[]).find(function(x){return x.id===id;});
  if(!l)return;
  var emrg=l.is_emergency?'<span class="badge urgent">Emergency</span> ':'';
  var half=l.half_day?'<span class="badge medium">Half Day</span> ':'';
  var rows=[
    ['Type',esc(l.leave_type)+' '+emrg+half],
    ['Dates',l.start_date+' to '+l.end_date+' ('+l.total_days+'d)'],
    ['Status',badge(l.status)],
    ['Reason',esc(l.reason)],
    ['Contact',esc(l.contact_during_leave||"Not provided")],
    ['Manager Comment',esc(l.manager_comment||"—")],
    ['Applied',fmtDateTime(l.created_at)]
  ];
  showInfoPopup("Leave Request #"+l.id,rows.map(function(r){return r;}),["Field","Details"]);
};
window.popupMgrLeave=function(key){
  var dash=state.leaveDash||{};
  if(key==="on_leave"){
    var rows=(dash.on_leave_employees||[]).map(function(e){return['<strong>'+esc(e.name)+'</strong>',esc(e.leave_type),'Until '+e.end_date];});
    showInfoPopup("On Leave Today",rows,["Employee","Type","Until"]);
  }else if(key==="upcoming"){
    var rows=(dash.upcoming_leaves||[]).map(function(e){return['<strong>'+esc(e.name)+'</strong>',esc(e.leave_type),e.start_date+' to '+e.end_date];});
    showInfoPopup("Upcoming Leaves (7 days)",rows,["Employee","Type","Dates"]);
  }else if(key==="conflicts"){
    var rows=(dash.conflict_details||[]).map(function(c){return[esc(getUserName(c.emp1_id)),esc(getUserName(c.emp2_id)),c.overlap_start+' to '+c.overlap_end];});
    showInfoPopup("Leave Conflicts",rows,["Employee 1","Employee 2","Overlap"]);
  }else if(key==="pending"){
    var rows=(dash.pending_requests||[]).map(function(p){return['<strong>'+esc(p.name)+'</strong>',esc(p.leave_type),p.start_date+' to '+p.end_date,p.total_days+'d'];});
    showInfoPopup("Pending Requests",rows,["Employee","Type","Dates","Days"]);
  }else{
    var leaves=state.leaves||[];
    var rows=leaves.map(function(l){return[esc(getUserName(l.user_id)),esc(l.leave_type),l.start_date,badge(l.status)];});
    showInfoPopup("All Leave Requests",rows,["Employee","Type","Date","Status"]);
  }
};
window.approveTask=async function(id){await api("/tasks/"+id,{method:"PUT",body:JSON.stringify({status:"completed"})});closeModal();await load();render();};
window.showRejectModal=function(id){var fb=prompt("Rejection feedback for employee:");if(fb)api("/tasks/"+id,{method:"PUT",body:JSON.stringify({status:"in_progress",rejection_feedback:fb})}).then(function(){closeModal();load().then(render);});};
window.deleteFile=async function(fid,tid){if(!confirm("Delete this file?"))return;await api("/files/"+fid,{method:"DELETE"});loadTaskFiles(tid);};
window.toggleAttDetail=function(id){var el=$(id);if(el)el.style.display=el.style.display==="none"?"table-row":"none";};
window.attCardClick=function(key){state._attCardFilter=(state._attCardFilter===key)?"":key;render();};
window.empAttCardClick=function(key){state._empAttCardFilter=(state._empAttCardFilter===key)?"":key;render();};
window.calPrev=function(){state.calMonth--;if(state.calMonth<0){state.calMonth=11;state.calYear--;}render();};
window.calNext=function(){state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}render();};

/* ====== UNIVERSAL INFO POPUP ====== */
window.showInfoPopup = function(title, rows, columns) {
  closeModal();
  columns = columns || ["Name","Detail","Status"];
  var thead = '<tr>' + columns.map(function(c){return '<th>'+esc(c)+'</th>';}).join("") + '</tr>';
  var tbody = rows.map(function(r) {
    return '<tr>' + r.map(function(cell){return '<td>'+cell+'</td>';}).join("") + '</tr>';
  }).join("");
  if (!tbody) tbody = '<tr><td colspan="'+columns.length+'" class="muted center">No data</td></tr>';

  var modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "taskModal";
  modal.onclick = function(e){if(e.target===modal)closeModal();};
  modal.innerHTML =
    '<div class="modal info-popup">' +
      '<div class="modal-header">' +
        '<h2>'+esc(title)+'</h2>' +
        '<button class="btn-icon" onclick="closeModal()">'+icon("close")+'</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="info-popup-count">'+rows.length+' item'+(rows.length!==1?'s':'')+'</div>' +
        '<div class="table-wrap"><table class="info-popup-table"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function(){modal.classList.add("active");},10);
};

/* Data resolvers for each clickable card */
function _tasksByStatus(status) {
  return state.tasks.filter(function(t){return t.status===status;}).map(function(t){
    return ['<strong>'+esc(t.title)+'</strong>', esc(getUserName(t.assigned_to_id)), badge(t.priority), daysLeft(t.deadline)];
  });
}
function _tasksByProp(filterFn) {
  return state.tasks.filter(filterFn).map(function(t){
    return ['<strong>'+esc(t.title)+'</strong>', esc(getUserName(t.assigned_to_id)), badge(t.status), badge(t.priority)];
  });
}

window.popupDashCard = function(key) {
  var cols = ["Task","Assigned To","Priority","Deadline"];
  var cols4 = ["Task","Assigned To","Status","Priority"];
  if (key === "total") showInfoPopup("All Tasks", _tasksByProp(function(){return true;}), cols4);
  else if (key === "completed") showInfoPopup("Completed Tasks", _tasksByStatus("completed"), cols);
  else if (key === "in_progress") showInfoPopup("In Progress Tasks", _tasksByStatus("in_progress"), cols);
  else if (key === "blocked") showInfoPopup("Blocked Tasks", _tasksByStatus("blocked"), cols);
  else if (key === "pending") showInfoPopup("Pending Tasks", _tasksByStatus("pending"), cols);
  else if (key === "employees") {
    var rows = state.report.map(function(r){
      return ['<div class="emp-cell"><div class="avatar-xs">'+initials(r.employee)+'</div><strong>'+esc(r.employee)+'</strong></div>', esc(r.email), r.completed_tasks+'/'+r.total_tasks+' done'];
    });
    showInfoPopup("All Employees", rows, ["Employee","Email","Tasks"]);
  }
  else if (key === "overdue") {
    var now = new Date();
    var rows = state.tasks.filter(function(t){return t.deadline && new Date(t.deadline)<now && t.status!=="completed";}).map(function(t){
      return ['<strong>'+esc(t.title)+'</strong>', esc(getUserName(t.assigned_to_id)), badge(t.status), daysLeft(t.deadline)];
    });
    showInfoPopup("Overdue Tasks", rows, cols);
  }
  else if (key === "under_review") {
    showInfoPopup("Under Review", _tasksByStatus("under_review"), cols);
  }
};

window.popupPerfCard = function(key) {
  if (key === "score") {
    var rows = (state.leaderboard||[]).map(function(r){
      return ['<strong>'+esc(r.name)+'</strong>', r.score+' pts', r.completed+'/'+r.total_tasks, '<span class="text-red">'+r.overdue+'</span>'];
    });
    showInfoPopup("Productivity Scores", rows, ["Employee","Score","Tasks Done","Overdue"]);
  }
  else if (key === "week") {
    var rows = state.tasks.filter(function(t){
      if(t.status!=="completed")return false;
      var d=new Date(t.updated_at); var w=new Date(); w.setDate(w.getDate()-7); return d>=w;
    }).map(function(t){ return ['<strong>'+esc(t.title)+'</strong>',esc(getUserName(t.assigned_to_id)),fmtDate(t.updated_at)]; });
    showInfoPopup("Completed This Week", rows, ["Task","By","Completed"]);
  }
  else if (key === "month") {
    var rows = state.tasks.filter(function(t){
      if(t.status!=="completed")return false;
      var d=new Date(t.updated_at); var m=new Date(); m.setDate(m.getDate()-30); return d>=m;
    }).map(function(t){ return ['<strong>'+esc(t.title)+'</strong>',esc(getUserName(t.assigned_to_id)),fmtDate(t.updated_at)]; });
    showInfoPopup("Completed This Month", rows, ["Task","By","Completed"]);
  }
  else if (key === "overdue") { window.popupDashCard("overdue"); }
};

window.popupAttCard = function(key) {
  var data = state.allAttendance || {};
  var emps = data.employees || [];
  var cols = ["Employee","Status","First In","Hours","Punches"];
  function attRow(a) {
    return ['<div class="emp-cell"><div class="avatar-xs">'+initials(a.name)+'</div><strong>'+esc(a.name)+'</strong></div>',
      attStatusBadge(a.status), a.summary.first_in?fmtTime(a.summary.first_in):'—',
      '<strong>'+a.summary.total_hours+'h</strong>', a.punch_count+''];
  }
  if (key==="all") showInfoPopup("All Employees", emps.map(attRow), cols);
  else if (key==="present") showInfoPopup("Present Today", emps.filter(function(a){return a.status!=="pending";}).map(attRow), cols);
  else if (key==="pending") showInfoPopup("Not Checked In", emps.filter(function(a){return a.status==="pending";}).map(attRow), cols);
  else if (key==="on_break") showInfoPopup("On Break", emps.filter(function(a){return a.status==="on_break";}).map(attRow), cols);
  else if (key==="completed") showInfoPopup("Day Complete", emps.filter(function(a){return a.status==="completed"||a.status==="overtime";}).map(attRow), cols);
  else if (key==="late") showInfoPopup("Late Arrivals", emps.filter(function(a){return a.summary&&a.summary.is_late;}).map(attRow), cols);
  else if (key==="hours") {
    var sorted = emps.slice().sort(function(a,b){return b.summary.total_hours-a.summary.total_hours;});
    showInfoPopup("Work Hours (Highest First)", sorted.map(attRow), cols);
  }
  else if (key==="break") {
    var sorted = emps.slice().sort(function(a,b){return b.summary.break_minutes-a.summary.break_minutes;});
    showInfoPopup("Break Time (Highest First)", sorted.map(function(a){
      return [attRow(a)[0], attRow(a)[1], attRow(a)[2], '<strong>'+a.summary.break_minutes+'m</strong>', a.punch_count+''];
    }), ["Employee","Status","First In","Break","Punches"]);
  }
};

window.popupEmpTimeline = function(userId) {
  var data = state.allAttendance || {};
  var emp = (data.employees||[]).find(function(a){return a.user_id===userId;});
  if (!emp) return;
  var rows = (emp.logs||[]).map(function(l) {
    var isIn = l.punch_type === "IN";
    return [fmtTime(l.timestamp), '<span class="badge '+(isIn?"completed":"pending")+'">'+l.punch_type+'</span>', esc(l.description||(isIn?"Checked in":"Checked out"))];
  });
  showInfoPopup(emp.name + " — Timeline", rows, ["Time","Type","Description"]);
};

/* ESC to close modal */
document.addEventListener("keydown", function(e){if(e.key==="Escape")closeModal();});

/* ====== AUTO-REFRESH ====== */
setInterval(function(){if(token()&&state.user)load().then(function(){});},30000);

/* ====== INIT ====== */
(async function(){if(token())await load();render();})();
