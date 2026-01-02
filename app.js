import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let currentEditing = { cid: null, originalNome: null };

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
                <div class="flex justify-between items-center">
                    <h3 class="font-black italic uppercase text-blue-500">${cid}</h3>
                    <button onclick="window.addNovoIP('${cid}')" class="text-[10px] bg-blue-600/10 hover:bg-blue-600 px-2 py-1 rounded text-blue-500 hover:text-white transition-all font-bold">+ NOVO IP</button>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600">CPU</p><p id="cpu-${cid}" class="text-xs font-black">--</p></div>
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600">RAM</p><p id="ram-${cid}" class="text-xs font-black">--</p></div>
                    <div class="bg-black/20 p-2 rounded-xl"><p class="text-[7px] text-slate-600 text-blue-500" id="sinc-${cid}">--</p><p id="boot-${cid}" class="text-[9px] font-black uppercase">--</p></div>
                </div>
                <div id="ips-${cid}" class="space-y-1"></div>
                <div id="procs-${cid}" class="max-h-64 overflow-y-auto pr-1 mt-2"></div>
            `;
            grid.appendChild(card);
        }

        const upText = (id, val) => { const el = document.getElementById(id); if(el && el.textContent !== val) el.textContent = val; };
        upText(`sinc-${cid}`, info.last_seen);
        upText(`cpu-${cid}`, info.hardware.cpu);
        upText(`ram-${cid}`, info.hardware.ram);
        upText(`boot-${cid}`, info.hardware.boot);

        // DISPOSITIVOS (Com Reconciliação)
        const ipCont = document.getElementById(`ips-${cid}`);
        const nomesServidor = info.dispositivos ? Object.keys(info.dispositivos) : [];
        
        // Remove locais que não existem mais no servidor
        Array.from(ipCont.children).forEach(child => {
            if(!nomesServidor.includes(child.dataset.nome)) child.remove();
        });

        for (let n in info.dispositivos) {
            const d = info.dispositivos[n];
            let row = ipCont.querySelector(`[data-nome="${n}"]`);
            const html = `
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase leading-none mb-1">${n}</span>
                    <span class="text-[8px] text-slate-500 font-mono">${d.ip}</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <span class="text-[8px] font-black uppercase ${d.status==='online'?'text-green-500':'text-red-500'}">${d.status}</span>
                        <p class="text-[10px] font-black text-blue-400 leading-none">${d.lat}ms</p>
                    </div>
                    <i class="fas fa-cog text-slate-700 hover:text-white text-xs cursor-pointer p-2"></i>
                </div>
            `;
            if(!row){
                row = document.createElement('div'); row.className="ip-item"; row.dataset.nome=n;
                row.onclick=(e)=>{ if(!e.target.classList.contains('fa-cog')) window.openStats(d); else window.prepararEdicao(cid, d); };
                row.innerHTML = html; ipCont.appendChild(row);
            } else if(row.innerHTML !== html) row.innerHTML = html;
        }

        // PROCESSOS (Mantido)
        const pCont = document.getElementById(`procs-${cid}`);
        const pids = info.processos.map(p => p.pid.toString());
        Array.from(pCont.children).forEach(c => { if(!pids.includes(c.dataset.pid)) c.remove(); });
        info.processos.forEach(p => {
            let pr = pCont.querySelector(`[data-pid="${p.pid}"]`);
            const h = `<span class="truncate w-24">${p.name}</span><div class="flex items-center gap-2"><span>${p.memory_percent.toFixed(1)}%</span><i onclick="window.cmd('${cid}','KILL',${p.pid})" class="fas fa-times text-red-900 cursor-pointer p-1"></i></div>`;
            if(!pr){
                pr = document.createElement('div'); pr.className="proc-item"; pr.dataset.pid=p.pid; pr.innerHTML=h; pCont.appendChild(pr);
            } else if(pr.innerHTML !== h) pr.innerHTML = h;
        });
    }
}

// FUNÇÕES DE GERENCIAMENTO (CRUD)
window.addNovoIP = (cid) => {
    const nome = prompt("Nome do dispositivo (Ex: Antena Garagem):");
    if(!nome) return;
    const ip = prompt("Endereço IP:");
    if(!ip) return;
    set(ref(db, `monitoramento/${cid}/config_dispositivos/${nome}`), ip);
};

window.prepararEdicao = (cid, d) => {
    currentEditing = { cid, originalNome: d.nome };
    document.getElementById('edit-nome').value = d.nome;
    document.getElementById('edit-ip').value = d.ip;
    window.openStats(d); // Abre o modal junto
};

document.getElementById('btn-salvar-edit').onclick = () => {
    const { cid, originalNome } = currentEditing;
    const novoNome = document.getElementById('edit-nome').value;
    const novoIP = document.getElementById('edit-ip').value;

    if(!novoNome || !novoIP) return;

    // Se o nome mudou, precisamos excluir o antigo e criar o novo
    if(novoNome !== originalNome) {
        remove(ref(db, `monitoramento/${cid}/config_dispositivos/${originalNome}`));
    }
    set(ref(db, `monitoramento/${cid}/config_dispositivos/${novoNome}`), novoIP);
    alert("Dispositivo atualizado!");
    fecharDetalhes();
};

document.getElementById('btn-excluir-ip').onclick = () => {
    if(confirm(`Excluir permanentemente ${currentEditing.originalNome}?`)) {
        remove(ref(db, `monitoramento/${currentEditing.cid}/config_dispositivos/${currentEditing.originalNome}`));
        fecharDetalhes();
    }
};

// MODAL E GRÁFICO
window.openStats = (d) => {
    document.getElementById('det-nome').innerText = d.nome;
    document.getElementById('det-ip').innerText = d.ip;
    document.getElementById('stat-min').innerText = d.min + "ms";
    document.getElementById('stat-max').innerText = d.max + "ms";
    document.getElementById('stat-avg').innerText = d.avg + "ms";
    document.getElementById('stat-fail').innerText = d.falha || "--";
    document.getElementById('modal-detalhes').classList.replace('hidden', 'flex');
    
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('mainChart'), {
        type: 'line',
        data: {
            labels: d.historico ? d.historico.map(h => new Date(h.t*1000).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})) : [],
            datasets: [{ label: 'Ping', data: d.historico ? d.historico.map(h => h.l) : [], borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59,130,246,0.1)', pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { ticks: { color: '#475569', font: { size: 9 } } } } }
    });
};

window.fecharDetalhes = () => document.getElementById('modal-detalhes').classList.replace('flex', 'hidden');

// COMANDOS E AUTH
window.cmd = (cid, acao, pid) => { if(confirm(`Deseja enviar ${acao} para o PID ${pid}?`)) set(ref(db, `monitoramento/${cid}/cmd`), { acao, pid, timestamp: Date.now() }); };

onAuthStateChanged(auth, (u) => {
    if (u) {
        document.getElementById('login-scr').classList.add('hidden');
        document.getElementById('dash-scr').classList.replace('hidden', 'flex');
        onValue(ref(db, 'monitoramento/'), (s) => render(s.val()));
    }
});

document.getElementById('btn-login').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pass').value);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());
