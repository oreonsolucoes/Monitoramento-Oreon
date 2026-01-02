import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD17hUBK6pY-E_hT9h8Nr0tyPp-5aBT4ZI",
    authDomain: "oreon-monitoramento.firebaseapp.com",
    databaseURL: "https://oreon-monitoramento-default-rtdb.firebaseio.com",
    projectId: "oreon-monitoramento",
    appId: "1:844248167462:web:eaedb32e3d78b60bd722e7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let chart = null;

// RENDERIZAÇÃO
function render(data) {
    if (!data) return;
    const grid = document.getElementById('grid-clientes');

    for (let cid in data) {
        let card = document.getElementById(`card-${cid}`);
        const info = data[cid].stats;
        if (!info) continue;

        if (!card) {
            card = document.createElement('div');
            card.id = `card-${cid}`;
            card.className = "card-monitor";
            card.innerHTML = `
                <div class="flex justify-between">
                    <h3 class="font-black italic uppercase text-blue-500">${cid}</h3>
                    <span id="sinc-${cid}" class="text-[9px] font-bold text-slate-500">--</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600">CPU</p><p id="cpu-${cid}" class="text-xs font-black">--</p></div>
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600">RAM</p><p id="ram-${cid}" class="text-xs font-black">--</p></div>
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600">BOOT</p><p id="boot-${cid}" class="text-xs font-black">--</p></div>
                </div>
                <div id="ips-${cid}" class="space-y-1"></div>
                <div id="procs-${cid}" class="max-h-64 overflow-y-auto pr-1"></div>
            `;
            grid.appendChild(card);
        }

        const update = (id, val) => { const el = document.getElementById(id); if(el && el.textContent !== val) el.textContent = val; };
        update(`sinc-${cid}`, info.last_seen);
        update(`cpu-${cid}`, info.hardware.cpu);
        update(`ram-${cid}`, info.hardware.ram);
        update(`boot-${cid}`, info.hardware.boot);

        // DISPOSITIVOS
        const ipCont = document.getElementById(`ips-${cid}`);
        for (let n in info.dispositivos) {
            const d = info.dispositivos[n];
            let row = ipCont.querySelector(`[data-nome="${n}"]`);
            const html = `<div class="flex flex-col"><span class="text-[10px] font-black text-white uppercase">${n}</span><span class="text-[8px] text-slate-500">${d.ip}</span></div><div class="text-right"><span class="text-[8px] font-black uppercase ${d.status==='online'?'text-green-500':'text-red-500'}">${d.status}</span><p class="text-[10px] font-black text-blue-400">${d.lat}ms</p></div>`;
            if(!row){
                row = document.createElement('div'); row.className="ip-item"; row.dataset.nome=n; row.onclick=()=>window.openStats(d);
                row.innerHTML = html; ipCont.appendChild(row);
            } else if(row.innerHTML !== html) row.innerHTML = html;
        }

        // PROCESSOS
        const pCont = document.getElementById(`procs-${cid}`);
        const pids = info.processos.map(p => p.pid.toString());
        Array.from(pCont.children).forEach(c => { if(!pids.includes(c.dataset.pid)) c.remove(); });
        info.processos.forEach(p => {
            let pr = pCont.querySelector(`[data-pid="${p.pid}"]`);
            const h = `<span class="truncate w-24">${p.name}</span><div class="flex items-center gap-2"><span>${p.memory_percent.toFixed(1)}%</span><i onclick="window.cmd('${cid}','KILL',${p.pid})" class="fas fa-times text-red-900 cursor-pointer"></i></div>`;
            if(!pr){
                pr = document.createElement('div'); pr.className="proc-item"; pr.dataset.pid=p.pid; pr.innerHTML=h; pCont.appendChild(pr);
            } else if(pr.innerHTML !== h) pr.innerHTML = h;
        });
    }
}

window.openStats = (d) => {
    document.getElementById('det-nome').innerText = d.nome;
    document.getElementById('det-ip').innerText = d.ip;
    document.getElementById('stat-min').innerText = d.min + "ms";
    document.getElementById('stat-max').innerText = d.max + "ms";
    document.getElementById('stat-avg').innerText = d.avg + "ms";
    document.getElementById('stat-fail').innerText = d.falha;
    document.getElementById('modal-detalhes').classList.replace('hidden', 'flex');
    
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('mainChart'), {
        type: 'line',
        data: {
            labels: d.historico.map(h => new Date(h.t*1000).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})),
            datasets: [{ label: 'Ping', data: d.historico.map(h => h.l), borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59,130,246,0.1)', pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
};

window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.replace('flex', 'hidden');
window.cmd = (cid, acao, pid) => { if(confirm("Encerrar processo?")) set(ref(db, `monitoramento/${cid}/cmd`), { acao, pid, timestamp: Date.now() }); };

onAuthStateChanged(auth, (u) => {
    if (u) {
        document.getElementById('login-scr').classList.add('hidden');
        document.getElementById('dash-scr').classList.replace('hidden', 'flex');
        onValue(ref(db, 'monitoramento/'), (s) => render(s.val()));
    }
});

document.getElementById('btn-login').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pass').value);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
