document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const lobby = document.getElementById('lobby');
    const moleGameView = document.getElementById('mole-game');
    const memoryGameView = document.getElementById('memory-game');
    const crossingView = document.getElementById('crossing-game') || { classList: { remove: () => {}, add: () => {} } };
    const menuCards = document.querySelectorAll('.menu-card');
    const lobbyBackBtns = document.querySelectorAll('.btn-lobby-back');
    const modal = document.getElementById('game-over');
    const modalLobbyBtn = document.getElementById('modal-lobby-btn');

    // Mole Elements
    const moleHoles = document.querySelectorAll('#mole-grid .hole');
    const moleScoreDisplay = document.getElementById('mole-score');
    const moleTimeDisplay = document.getElementById('mole-time-left');
    const moleTimerBar = document.getElementById('mole-timer-bar');
    const moleStartBtn = document.getElementById('mole-start-btn');

    // Memory Elements
    const memoryGrid = document.getElementById('memory-grid');
    const memoryMatchesDisplay = document.getElementById('memory-matches');
    const memoryTimeDisplay = document.getElementById('memory-time-left');
    const memoryTimerBar = document.getElementById('memory-timer-bar');
    const memoryRestartBtn = document.getElementById('memory-restart-btn');

    // Crossing 3D Elements
    const crossing3DContainer = document.getElementById('crossing-3d-container');
    const crossingScoreDisplay = document.getElementById('crossing-score');
    const crossingTimeDisplay = document.getElementById('crossing-time-left');
    const crossingTimerBar = document.getElementById('crossing-timer-bar');
    const crossingStartBtn = document.getElementById('crossing-start-btn');

    // Audio Context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'hit') {
            osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
        } else if (type === 'flip') {
            osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.05);
        } else if (type === 'match') {
            osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
            gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        } else if (type === 'start') {
            osc.type = 'square'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        } else if (type === 'jump') {
            osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
        } else if (type === 'crash') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(10, now + 0.3);
            gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
        }
        osc.start(now); osc.stop(now + 0.3);
    }

    // --- View Management ---
    function showView(viewName) {
        [lobby, moleGameView, memoryGameView, crossingView].forEach(v => v.classList.remove('active'));
        if (viewName === 'lobby') { lobby.classList.add('active'); stopAll(); }
        else if (viewName === 'mole') { moleGameView.classList.add('active'); initMole3D(); }
        else if (viewName === 'memory') { memoryGameView.classList.add('active'); initMemoryGame(); }
        else if (viewName === 'crossing') { crossingView.classList.add('active'); initCrossing3D(); }
        modal.classList.remove('visible');
    }

    function stopAll() { stopMole(); stopMemory(); stopCrossing3D(); }

    menuCards.forEach(card => card.addEventListener('click', () => showView(card.dataset.game)));
    lobbyBackBtns.forEach(btn => btn.addEventListener('click', () => showView('lobby')));
    modalLobbyBtn.addEventListener('click', () => { modal.classList.remove('visible'); showView('lobby'); });

    // --- 3D Whack-a-Mole Logic ---
    let moleScene, moleCamera, moleRenderer, moleHoles3D = [], moleTimeLeft = 15, moleTimerId, molePeepId, moleTimeUp = true, moleScore = 0;
    let hammer3D; // The toy hammer
    let normalEyeMat, dizzyEyeMat; // Eye materials
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function initMole3D() {
        if (!moleRenderer) {
            const container = document.getElementById('mole-3d-container');
            moleScene = new THREE.Scene();
            moleScene.background = new THREE.Color(0xd7f3eb);
            moleCamera = new THREE.PerspectiveCamera(45, container.offsetWidth / 350, 0.1, 1000);
            moleCamera.position.set(0, 10, 12);
            moleCamera.lookAt(0, 0, 0);
            
            moleRenderer = new THREE.WebGLRenderer({ antialias: true });
            moleRenderer.setSize(container.offsetWidth, 350);
            moleRenderer.shadowMap.enabled = true;
            container.appendChild(moleRenderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); moleScene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); dirLight.position.set(5, 10, 5); dirLight.castShadow = true; moleScene.add(dirLight);

            // Create Ground (Grass/Dirt)
            const groundGeo = new THREE.PlaneGeometry(40, 40);
            const groundMat = new THREE.MeshLambertMaterial({ color: 0x81c784 });
            const ground = new THREE.Mesh(groundGeo, groundMat);
            ground.rotation.x = -Math.PI / 2;
            ground.receiveShadow = true;
            moleScene.add(ground);

            // Add Grass Tufts for "Real Grass" look
            for (let i = 0; i < 300; i++) {
                const grassGeo = new THREE.PlaneGeometry(0.3, 0.4);
                const grassMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a, side: THREE.DoubleSide });
                const grass = new THREE.Mesh(grassGeo, grassMat);
                grass.position.set(Math.random() * 30 - 15, 0.2, Math.random() * 30 - 15);
                grass.rotation.y = Math.random() * Math.PI;
                moleScene.add(grass);
            }

            // Create Hammer
            hammer3D = new THREE.Group();
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2), new THREE.MeshLambertMaterial({ color: 0xffeb3b }));
            handle.rotation.x = Math.PI / 2; // Pointing towards camera
            handle.position.z = 1;
            const head = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 32), new THREE.MeshLambertMaterial({ color: 0xff5252 }));
            head.rotation.z = 0; // Cylinder is vertical
            hammer3D.add(handle);
            hammer3D.add(head);
            hammer3D.position.set(0, 2, 0);
            moleScene.add(hammer3D);

            // Create 9 Holes in 3x3 Grid
            for (let i = 0; i < 9; i++) {
                const x = (i % 3 - 1) * 4;
                const z = (Math.floor(i / 3) - 1) * 4;
                
                // Hole Mesh (Dark Circle)
                const holeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
                const holeMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
                const hole = new THREE.Mesh(holeGeo, holeMat);
                hole.position.set(x, 0, z);
                moleScene.add(hole);

                // Mole Group (Mole Appearance)
                const moleGroup = new THREE.Group();
                moleGroup.position.set(x, -2, z); // Start hidden
                
                // Brown Body
                const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshLambertMaterial({ color: 0x795548 }));
                body.scale.set(1, 1.2, 0.9);
                body.castShadow = true;
                moleGroup.add(body);

                // Pink Nose
                const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshLambertMaterial({ color: 0xff8b94 }));
                nose.position.set(0, 0.2, 0.8);
                moleGroup.add(nose);

                // Small Eyes
                const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                eyeL.position.set(0.25, 0.45, 0.75);
                eyeL.userData.isEye = true;
                eyeL.userData.isLeft = true;
                moleGroup.add(eyeL);
                const eyeR = eyeL.clone(); 
                eyeR.position.x = -0.25;
                eyeR.userData = { isEye: true, isLeft: false };
                moleGroup.add(eyeR);
                
                moleGroup.userData = { id: i, state: 'down', targetY: -2 };
                moleScene.add(moleGroup);
                moleHoles3D.push(moleGroup);
            }

            container.addEventListener('mousemove', onMouseMove);
            container.addEventListener('mousedown', onMoleClick);
            animateMole3D();
        }
        resetMole();
    }

    let hammerVel = new THREE.Vector3(0,0,0);
    const hammerFriction = 0.85;
    const hammerSpring = 0.15;

    function onMouseMove(event) {
        const rect = moleRenderer.domElement.getBoundingClientRect();
        // Clamp mouse to prevent infinity fly-away
        let mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        let my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        mouse.x = Math.max(-0.9, Math.min(0.9, mx));
        mouse.y = Math.max(-0.8, Math.min(0.5, my)); // Prevent going too high/horizon
    }

    function onMoleClick(event) {
        if (moleTimeUp) return;
        
        // Hammer Vertical Smash Animation
        if(hammer3D) {
            const startTime = performance.now();
            function animateWhack(time) {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / 150, 1);
                // Vertical smash: pivot handle down
                if(progress < 0.4) {
                    hammer3D.rotation.x = -(progress / 0.4) * (Math.PI * 0.4);
                    hammer3D.position.y = 2 - (progress / 0.4) * 1.5;
                } else {
                    hammer3D.rotation.x = -((1 - progress) / 0.6) * (Math.PI * 0.4);
                    hammer3D.position.y = 0.5 + ((progress - 0.4) / 0.6) * 1.5;
                }
                
                if(progress < 1) requestAnimationFrame(animateWhack);
                else { hammer3D.rotation.x = 0; hammer3D.position.y = 2; }
            }
            requestAnimationFrame(animateWhack);
        }

        const rect = moleRenderer.domElement.getBoundingClientRect();
        let mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        let my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        mouse.x = Math.max(-0.9, Math.min(0.9, mx));
        mouse.y = Math.max(-0.8, Math.min(0.5, my));
        
        raycaster.setFromCamera(mouse, moleCamera);
        const intersects = raycaster.intersectObjects(moleHoles3D, true);
        if (intersects.length > 0) {
            let mole = intersects[0].object;
            while(mole && mole.userData.id === undefined && mole.parent) {
                mole = mole.parent;
            }
            if (mole && mole.userData.id !== undefined && mole.userData.state === 'up') {
                playSound('hit');
                moleScore++;
                moleScoreDisplay.textContent = moleScore;
                mole.userData.state = 'hit';
                mole.userData.targetY = -2;
            }
        }
    }

    function animateMole3D() {
        requestAnimationFrame(animateMole3D);
        
        // Physics for Hammer Follow
        if(hammer3D && moleRenderer) {
            const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
            vector.unproject(moleCamera);
            const dir = vector.sub(moleCamera.position).normalize();
            const distance = -moleCamera.position.y / dir.y + 2;
            const targetPos = moleCamera.position.clone().add(dir.multiplyScalar(distance));
            
            // Spring physics logic
            let force = targetPos.sub(hammer3D.position);
            force.y = 0; // Keep on plane
            hammerVel.add(force.multiplyScalar(hammerSpring));
            hammerVel.multiplyScalar(hammerFriction);
            hammer3D.position.add(hammerVel);
            
            // Add a slight tilt based on velocity
            hammer3D.rotation.x = hammerVel.z * 0.5;
            hammer3D.rotation.y = -hammerVel.x * 0.5;
        }

        moleHoles3D.forEach(mole => {
            mole.position.y += (mole.userData.targetY - mole.position.y) * 0.2;
            if (mole.userData.state === 'hit' && mole.position.y < -1.8) {
                mole.userData.state = 'down';
            }
        });
        moleRenderer.render(moleScene, moleCamera);
    }

    function resetMole() {
        moleScore = 0; moleTimeLeft = 15;
        moleScoreDisplay.textContent = 0; moleTimeDisplay.textContent = 15;
        moleTimerBar.style.width = '100%';
        moleHoles3D.forEach(m => { m.userData.state = 'down'; m.userData.targetY = -2; m.position.y = -2; });
        if(hammer3D) {
            hammer3D.position.set(0, 2, 0);
            hammerVel.set(0, 0, 0);
            hammer3D.visible = true;
        }
    }

    function molePeep() {
        if (moleTimeUp) return;
        const availableMoles = moleHoles3D.filter(m => m.userData.state === 'down');
        if (availableMoles.length > 0) {
            const mole = availableMoles[Math.floor(Math.random() * availableMoles.length)];
            mole.userData.state = 'up';
            mole.userData.targetY = 0.5;
            // Difficulty factor: speed up as time goes on (1.0 at start, ~2.5 at end)
            const speedFactor = 1 + (15 - moleTimeLeft) / 10;
            
            setTimeout(() => {
                if (mole.userData.state === 'up') {
                    mole.userData.state = 'down';
                    mole.userData.targetY = -2;
                }
            }, (800 + Math.random() * 500) / speedFactor);
        }
        const nextPeepDelay = (600 + Math.random() * 400) / (1 + (15 - moleTimeLeft) / 8);
        molePeepId = setTimeout(molePeep, nextPeepDelay);
    }

    moleStartBtn.addEventListener('click', () => {
        playSound('start'); resetMole(); moleTimeUp = false; molePeep();
        moleTimerId = setInterval(() => {
            moleTimeLeft--; moleTimeDisplay.textContent = moleTimeLeft; moleTimerBar.style.width = `${(moleTimeLeft/15)*100}%`;
            if (moleTimeLeft <= 0) {
                moleTimeUp = true; clearInterval(moleTimerId); clearTimeout(molePeepId);
                if(hammer3D) hammer3D.visible = false;
                
                // Show Time's Up Overlay
                const overlay = document.getElementById('times-up-overlay');
                overlay.style.display = 'flex';
                
                setTimeout(() => {
                    overlay.style.display = 'none';
                    showGameOver('時間到！⏰', '你的最終得分是', moleScore);
                }, 1500);
            }
        }, 1000);
    });

    // --- Memory Match Logic ---
    const icons = ['🍦', '🍰', '🍩', '🍪', '🍓', '🍒', '🍭', '🍮'];
    let flippedCards = [], matches = 0, isLock = false, memoryTimeLeft = 45, memoryTimerId, memoryTimeUp = true;
    function stopMemory() { memoryTimeUp = true; clearInterval(memoryTimerId); }
    function initMemoryGame() {
        stopMemory(); memoryGrid.innerHTML = ''; flippedCards = []; matches = 0; isLock = false; memoryTimeUp = false;
        memoryTimeLeft = 45; memoryMatchesDisplay.textContent = 0; memoryTimeDisplay.textContent = 45; memoryTimerBar.style.width = '100%';
        const deck = [...icons, ...icons].sort(() => Math.random() - 0.5);
        deck.forEach(icon => {
            const card = document.createElement('div'); card.className = 'memory-card'; card.dataset.icon = icon;
            card.innerHTML = `<div class="card-face card-back"></div><div class="card-face card-front">${icon}</div>`;
            card.addEventListener('click', flipCard); memoryGrid.appendChild(card);
        });
        memoryTimerId = setInterval(() => {
            if (memoryTimeUp) return;
            memoryTimeLeft--; memoryTimeDisplay.textContent = memoryTimeLeft; memoryTimerBar.style.width = `${(memoryTimeLeft/45)*100}%`;
            if (memoryTimeLeft <= 0) { stopMemory(); isLock = true; showGameOver('時間到！⏰', '你成功的配對數：', matches); }
        }, 1000);
    }
    function flipCard() {
        if (isLock || memoryTimeUp || this.classList.contains('flipped') || this.classList.contains('matched')) return;
        playSound('flip'); this.classList.add('flipped'); flippedCards.push(this);
        if (flippedCards.length === 2) {
            isLock = true;
            if (flippedCards[0].dataset.icon === flippedCards[1].dataset.icon) {
                matches++; memoryMatchesDisplay.textContent = matches;
                flippedCards.forEach(c => c.classList.add('matched'));
                flippedCards = []; isLock = false; playSound('match');
                if (matches === 8) { stopMemory(); setTimeout(() => showGameOver('超強記憶力！⭐', '你成功完成了挑戰！剩餘時間：', memoryTimeLeft + '秒'), 500); }
            } else {
                setTimeout(() => { flippedCards.forEach(c => c.classList.remove('flipped')); flippedCards = []; isLock = false; }, 800);
            }
        }
    }
    memoryRestartBtn.addEventListener('click', () => { playSound('start'); initMemoryGame(); });

    // --- Chicks Crossing 3D Logic ---
    let scene, camera, renderer, chick3D, crossingScore = 0, crossingTimeLeft = 30, crossingTimerId, crossingActive = false;
    let cars3D = [], carSpawnerId;

    function initCrossing3D() {
        if (!renderer) {
            scene = new THREE.Scene(); scene.background = new THREE.Color(0xa8e6cf);
            camera = new THREE.PerspectiveCamera(75, crossing3DContainer.offsetWidth / 350, 0.1, 1000); camera.position.set(0, 8, 10);
            renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(crossing3DContainer.offsetWidth, 350); renderer.shadowMap.enabled = true;
            crossing3DContainer.appendChild(renderer.domElement);
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(5, 10, 5); dirLight.castShadow = true; scene.add(dirLight);
            const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffeb3b })); body.castShadow = true;
            const beak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xff9800 })); beak.position.set(0, 0, 0.5);
            chick3D = new THREE.Group(); chick3D.add(body); chick3D.add(beak); chick3D.position.y = 0.5; scene.add(chick3D);
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 40), new THREE.MeshLambertMaterial({ color: 0x81c784 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
            for(let i=0; i<4; i++) {
                const road = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), new THREE.MeshLambertMaterial({ color: 0x78909c }));
                road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.position.z = 0 - (i * 4); scene.add(road);
            }
            animate3D();
        }
        resetCrossing3D();
    }
    function animate3D() {
        requestAnimationFrame(animate3D);
        if (crossingActive) {
            cars3D.forEach((car, index) => {
                car.position.x += car.userData.speed * car.userData.direction;
                if (Math.abs(car.position.x) > 12) { scene.remove(car); cars3D.splice(index, 1); }
                if (car.position.distanceTo(chick3D.position) < 1.2) {
                    playSound('crash'); stopCrossing3D(); showGameOver('救援失敗！😵', '小雞在馬路上受傷了...', crossingScore);
                }
            });
            camera.position.z = chick3D.position.z + 6; camera.lookAt(chick3D.position.x, 0, chick3D.position.z);
        }
        renderer.render(scene, camera);
    }
    function spawnCar3D() {
        if (!crossingActive) return;
        const laneIdx = Math.floor(Math.random() * 4); const direction = laneIdx % 2 === 0 ? 1 : -1;
        const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.5), new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));
        car.position.set(direction === 1 ? -12 : 12, 0.5, 0 - (laneIdx * 4)); car.userData = { speed: Math.random() * 0.1 + 0.1, direction: direction };
        scene.add(car); cars3D.push(car);
    }
    function resetCrossing3D() {
        stopCrossing3D(); crossingScore = 0; crossingTimeLeft = 30;
        crossingScoreDisplay.textContent = 0; crossingTimeDisplay.textContent = 30; crossingTimerBar.style.width = '100%';
        chick3D.position.set(0, 0.5, 4); cars3D.forEach(c => scene.remove(c)); cars3D = [];
    }
    function stopCrossing3D() { crossingActive = false; clearInterval(crossingTimerId); clearInterval(carSpawnerId); }
    crossingStartBtn.addEventListener('click', () => {
        playSound('start'); resetCrossing3D(); crossingActive = true;
        carSpawnerId = setInterval(spawnCar3D, 800);
        crossingTimerId = setInterval(() => {
            crossingTimeLeft--; crossingTimeDisplay.textContent = crossingTimeLeft; crossingTimerBar.style.width = `${(crossingTimeLeft/30)*100}%`;
            if (crossingTimeLeft <= 0) { stopCrossing3D(); showGameOver('救援時間結束！🏁', '你成功救出的次數：', crossingScore); }
        }, 1000);
    });
    crossing3DContainer.addEventListener('mousedown', () => {
        if (!crossingActive) return; playSound('jump'); chick3D.position.z -= 1;
        if (chick3D.position.z < -14) { crossingScore++; crossingScoreDisplay.textContent = crossingScore; playSound('match'); chick3D.position.z = 4; }
    });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && crossingView.classList.contains('active')) { crossing3DContainer.dispatchEvent(new Event('mousedown')); }
    });

    // --- Modal ---
    function showGameOver(title, msg, val) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-msg').textContent = msg;
        document.getElementById('final-score-val').textContent = val;
        modal.classList.add('visible');
    }
    // --- Modal Logic (Global for inline onclick) ---
    window.handleRestart = () => {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        if (moleGameView.classList.contains('active')) {
            initMole3D();
            moleStartBtn.click();
        } else if (memoryGameView.classList.contains('active')) {
            memoryRestartBtn.click();
        } else if (crossingView.classList.contains('active')) {
            crossingStartBtn.click();
        }
    };

    window.handleGoLobby = () => {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        showView('lobby');
    };
});
