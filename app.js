class ZenithCommander {
    constructor() {
        this.agents = [
            { id: 'friday', name: 'FRIDAY', role: 'Generalist', status: 'online', task: 'Monitoring system vitals' },
            { id: 'researcher', name: 'NEXUS-7', role: 'Research', status: 'idle', task: 'Waiting for directive' },
            { id: 'builder', name: 'FORGE', role: 'Architecture', status: 'idle', task: 'Standing by' }
        ];

        this.missions = {
            id: 'root',
            label: 'SYSTEM INITIALIZATION',
            status: 'completed',
            children: [
                { id: 'm1', label: 'NEURAL LINK ESTABLISHED', status: 'completed', children: [] },
                { id: 'm2', label: 'HIVE PROTOCOLS ACTIVE', status: 'active', children: [
                    { id: 'm3', label: 'SWARM SYNCHRONIZATION', status: 'active', children: [] }
                ]}
            ]
        };

        this.initDOM();
        this.renderAgents();
        this.renderMissionTree();
        this.startTelemetry();
        this.bindEvents();
    }

    initDOM() {
        this.agentList = document.getElementById('agent-list');
        this.svg = document.getElementById('mission-svg');
        this.logContainer = document.getElementById('log-container');
        this.commandInput = document.getElementById('command-input');
        this.sendBtn = document.getElementById('send-btn');
        this.agentCountLabel = document.getElementById('agent-count');
    }

    bindEvents() {
        this.sendBtn.addEventListener('click', () => this.handleCommand());
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleCommand();
        });

        // Connect to Server-Sent Events (SSE)
        this.connectToCore();
    }

    async connectToCore() {
        this.addLog('SYS', 'Establishing link to Zenith Core...');
        const eventSource = new EventSource('/events');

        eventSource.onmessage = (event) => {
            const payload = JSON.parse(event.data);
            if (payload.type === 'log') {
                this.addLog(payload.data.type, payload.data.msg);
            } else if (payload.type === 'status') {
                this.updateAgentStates(payload.agents);
            }
        };

        eventSource.onerror = () => {
            this.addLog('ERR', 'Core link severed. Retrying...');
        };
    }

    updateAgentStates(agentData) {
        Object.keys(agentData).forEach(id => {
            const agent = this.agents.find(a => a.id === id);
            if (agent) {
                agent.status = agentData[id].status;
                agent.task = agentData[id].task;
            }
        });
        this.renderAgents();
    }

    async handleCommand() {
        const cmd = this.commandInput.value.trim();
        if (!cmd) return;

        this.addLog('CMD', cmd);
        this.commandInput.value = '';

        try {
            const res = await fetch('/mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal: cmd })
            });

            if (res.ok) {
                this.updateMission(cmd);
                // Highlight the input area briefly
                document.querySelector('.input-area').style.borderColor = 'var(--cyan)';
                setTimeout(() => {
                    document.querySelector('.input-area').style.borderColor = 'var(--glass-border)';
                }, 500);
            } else {
                this.addLog('ERR', 'Directive rejected by Core.');
            }
        } catch (err) {
            this.addLog('ERR', 'Command transmission failed.');
        }
    }

    addLog(type, message) {
        const time = new Date().toLocaleTimeString([], { hour12: false });
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span>[${time}] [${type}]</span> ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    renderAgents() {
        this.agentList.innerHTML = '';
        this.agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = `agent-card ${agent.status === 'online' ? 'active' : ''}`;
            card.innerHTML = `
                <div class="agent-header">
                    <span class="agent-name">${agent.name} <span style="font-size: 10px; opacity: 0.5;">[${agent.role}]</span></span>
                    <div class="agent-status-dot"></div>
                </div>
                <div class="agent-task">${agent.task}</div>
            `;
            this.agentList.appendChild(card);
        });
        this.agentCountLabel.innerText = this.agents.length;
    }

    renderMissionTree() {
        // Simple recursive layout for the mission tree
        this.svg.innerHTML = '';
        const width = this.svg.clientWidth;
        const height = this.svg.clientHeight;
        
        const drawNode = (node, x, y, level) => {
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            
            // Draw Circle
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", "12");
            circle.setAttribute("fill", node.status === 'active' ? 'var(--cyan)' : 'var(--blue)');
            circle.setAttribute("filter", "url(#glow)");
            if (node.status === 'active') {
                const anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
                anim.setAttribute("attributeName", "r");
                anim.setAttribute("values", "12;15;12");
                anim.setAttribute("dur", "2s");
                anim.setAttribute("repeatCount", "indefinite");
                circle.appendChild(anim);
            }

            // Label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x + 20);
            text.setAttribute("y", y + 5);
            text.setAttribute("fill", "#fff");
            text.setAttribute("font-size", "10px");
            text.setAttribute("font-family", "var(--font-heading)");
            text.textContent = node.label.toUpperCase();

            group.appendChild(circle);
            group.appendChild(text);
            this.svg.appendChild(group);

            if (node.children) {
                node.children.forEach((child, i) => {
                    const childX = x + 150;
                    const childY = y + (i - (node.children.length - 1) / 2) * 80;
                    
                    // Connection line
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    const d = `M ${x+12} ${y} C ${x+80} ${y}, ${x+80} ${childY}, ${childX-12} ${childY}`;
                    line.setAttribute("d", d);
                    line.setAttribute("stroke", "rgba(0, 242, 255, 0.2)");
                    line.setAttribute("stroke-width", "2");
                    line.setAttribute("fill", "none");
                    this.svg.appendChild(line);

                    drawNode(child, childX, childY, level + 1);
                });
            }
        };

        drawNode(this.missions, 100, height / 2, 0);
    }

    updateMission(goal) {
        // Mock updating the tree
        const newNode = { id: Date.now(), label: goal, status: 'active', children: [] };
        
        // Find an active node to append to
        const findAndAppend = (node) => {
            if (node.status === 'active' && node.children.length < 2) {
                node.children.push(newNode);
                return true;
            }
            for (let child of node.children) {
                if (findAndAppend(child)) return true;
            }
            return false;
        };

        if (findAndAppend(this.missions)) {
            this.renderMissionTree();
            this.agents[1].status = 'online';
            this.agents[1].task = `Researching: ${goal}`;
            this.renderAgents();
            this.addLog('HIVE', `Nexus-7 assigned to objective: ${goal}`);
        }
    }

    startTelemetry() {
        setInterval(() => {
            const burst = Math.floor(Math.random() * 40) + 30;
            document.getElementById('burst-val').innerText = `${burst}%`;
            document.getElementById('burst-bar').style.width = `${burst}%`;
            
            const tokens = Math.floor(Math.random() * 50) + 100;
            document.getElementById('token-val').innerText = tokens;
            
            const now = new Date();
            document.getElementById('uptime').innerText = now.toLocaleTimeString([], { hour12: false });
        }, 1500);
    }
}

// Initialize on load
window.addEventListener('load', () => {
    window.commander = new ZenithCommander();
});
