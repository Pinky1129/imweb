document.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // Navigation
    const lobby = document.getElementById('lobby');
    const moleGameView = document.getElementById('mole-game');
    const memoryGameView = document.getElementById('basketball-game');
    const crossingView = document.getElementById('crossing-game') || { classList: { remove: () => {}, add: () => {}, contains: () => false } };
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

    // Basketball Elements
    const basketContainer = document.getElementById('basket-3d-container');
    const basketScoreDisplay = document.getElementById('basket-score');
    const basketTimeDisplay = document.getElementById('basket-time-left');
    const basketTimerBar = document.getElementById('basket-timer-bar');
    const basketStartBtn = document.getElementById('basket-start-btn');

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
        else if (viewName === 'basketball') { memoryGameView.classList.add('active'); initBasketGame(); }
        else if (viewName === 'crossing') { crossingView.classList.add('active'); initCrossing3D(); }
        modal.classList.remove('visible');
    }

    function stopAll() { stopMole(); stopBasket(); stopCrossing3D(); }

    // --- 選單點擊音效 ---
    const menuClickSound = new Audio('menu_click.mp3');

    menuCards.forEach(card => card.addEventListener('click', () => {
        menuClickSound.currentTime = 0;
        menuClickSound.play();
        showView(card.dataset.game);
    }));
    lobbyBackBtns.forEach(btn => btn.addEventListener('click', () => {
        menuClickSound.currentTime = 0;
        menuClickSound.play();
        showView('lobby');
    }));
    if (modalLobbyBtn) {
        modalLobbyBtn.addEventListener('click', () => {
            menuClickSound.currentTime = 0;
            menuClickSound.play();
            modal.classList.remove('visible'); showView('lobby');
        });
    }

    // --- 3D Whack-a-Mole Logic ---
    let moleScene, moleCamera, moleRenderer, moleHoles3D = [], moleTimeLeft = 15, moleTimerId, molePeepId, moleTimeUp = true, moleScore = 0;
    let hammer3D; // The toy hammer
    let normalEyeMat, dizzyEyeMat; // Eye materials
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // 自訂打地鼠音效
    const moleHitSounds = [
        new Audio('mole_hit.mp3'),
        new Audio('mole_hit2.mp3'),
        new Audio('mole_hit3.mp3')
    ];
    let lastMoleHitIdx = -1;
    function playMoleHit() {
        moleHitSounds.forEach(s => { s.pause(); s.currentTime = 0; });
        let idx;
        do { idx = Math.floor(Math.random() * moleHitSounds.length); }
        while (idx === lastMoleHitIdx && moleHitSounds.length > 1);
        lastMoleHitIdx = idx;
        const playPromise = moleHitSounds[idx].play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                // 如果找不到對應的音效檔（例如使用者沒放），就退回播放第一種音效，保證一定有聲音
                if (idx !== 0) {
                    moleHitSounds[0].currentTime = 0;
                    moleHitSounds[0].play().catch(e => console.log(e));
                }
            });
        }
    }
    const moleMissSound = new Audio('mole_miss.mp3');
    const molePopSound = new Audio('mole_pop.mp3');

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

                // Invisible HitBox (Makes clicking much easier)
                const hitBox = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 16), new THREE.MeshBasicMaterial({ visible: false }));
                hitBox.position.set(0, 0, 0);
                moleGroup.add(hitBox);

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
                
                // --- 鬍鬚 (Like a cat: 3 white whiskers on each side) ---
                const whiskerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                const whiskerGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.2); // Longer and thinner
                for (let j = 0; j < 3; j++) {
                    const whiskerL = new THREE.Mesh(whiskerGeo, whiskerMat);
                    whiskerL.rotation.z = Math.PI / 2;
                    whiskerL.rotation.y = 0.5 + (j - 1) * 0.25;
                    whiskerL.position.set(0.6, 0.2 + (j - 1) * 0.1, 0.8);
                    moleGroup.add(whiskerL);

                    const whiskerR = new THREE.Mesh(whiskerGeo, whiskerMat);
                    whiskerR.rotation.z = Math.PI / 2;
                    whiskerR.rotation.y = -0.5 - (j - 1) * 0.25;
                    whiskerR.position.set(-0.6, 0.2 + (j - 1) * 0.1, 0.8);
                    moleGroup.add(whiskerR);
                }
                
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
        let hitSuccess = false;

        if (intersects.length > 0) {
            let mole = intersects[0].object;
            while(mole && mole.userData.id === undefined && mole.parent) {
                mole = mole.parent;
            }
            if (mole && mole.userData.id !== undefined && mole.userData.state === 'up') {
                hitSuccess = true;
                playMoleHit();
                moleScore++;
                moleScoreDisplay.textContent = moleScore;
                mole.userData.state = 'hit';
                mole.userData.targetY = -2;
            }
        }

        if (!hitSuccess) {
            moleMissSound.currentTime = 0;
            moleMissSound.play(); // 揮動槌子的音效（揮空）
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
            molePopSound.currentTime = 0;
            molePopSound.play(); // 地鼠冒出來的音效
            // Difficulty factor: speed up as time goes on (1.0 at start, ~1.6 at end) - Slower than before
            const speedFactor = 1 + (15 - moleTimeLeft) / 25;
            
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

    // --- Ji-ge Basketball Logic ---
    let basketScene, basketCamera, basketRenderer, hoop, backboard, balls = [], basketScore = 0, basketTimeLeft = 30, basketTimerId, basketTimeUp = true;
    let hoopDirection = 1, hoopSpeed = 0.1, playerRooster;
    let basketMouse = new THREE.Vector2();
    let chargeStart = null, isCharging = false;
    let lastScoreIdx = -1; // 記錄上次播放的音效索引，避免重複

    // 進球音效
    const basketScoreSounds = [
        new Audio('score1.mp3'),
        new Audio('score2.mp3'),
        new Audio('score3.mp3'),
        new Audio('score4.mp3'),
    ];
    basketScoreSounds.forEach(s => s.playbackRate = 1.5);

    // 沒進音效
    const basketMissSounds = [
        new Audio('miss.mp3'),
        new Audio('miss2.mp3'),
        new Audio('miss3.mp3'),
        new Audio('miss4.mp3')
    ];
    basketMissSounds.forEach(s => s.playbackRate = 1.5);
    let lastMissIdx = -1;

    function playBasketMiss() {
        basketMissSounds.forEach(s => { s.pause(); s.currentTime = 0; });
        let idx;
        do { idx = Math.floor(Math.random() * basketMissSounds.length); }
        while (idx === lastMissIdx && basketMissSounds.length > 1);
        lastMissIdx = idx;
        basketMissSounds[idx].play();
    }

    function playBasketScore() {
        // 先停止所有進球音效，避免重疊
        basketScoreSounds.forEach(s => { s.pause(); s.currentTime = 0; });
        // 選一個跟上次不一樣的
        let idx;
        do { idx = Math.floor(Math.random() * basketScoreSounds.length); }
        while (idx === lastScoreIdx && basketScoreSounds.length > 1);
        lastScoreIdx = idx;
        basketScoreSounds[idx].play();
    }

    function initBasketGame() {
        if (!basketRenderer) {
            const container = document.getElementById('basket-3d-container');
            basketScene = new THREE.Scene();
            basketScene.background = new THREE.Color(0xe8f4f8); // 淺藍白
            basketCamera = new THREE.PerspectiveCamera(65, container.offsetWidth / 350, 0.1, 1000);
            basketCamera.position.set(0, 10, 18); // 拉高、拉遠，看到整隻雞和球場
            basketCamera.lookAt(0, 3, 2);

            // 鍵盤控制狀態
            window.basketKeys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
            window.addEventListener('keydown', e => { if (window.basketKeys.hasOwnProperty(e.key)) window.basketKeys[e.key] = true; });
            window.addEventListener('keyup', e => { if (window.basketKeys.hasOwnProperty(e.key)) window.basketKeys[e.key] = false; });

            basketRenderer = new THREE.WebGLRenderer({ antialias: true });
            basketRenderer.setSize(container.offsetWidth, 350);
            basketRenderer.shadowMap.enabled = true;
            basketRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(basketRenderer.domElement);

            // Power Bar UI
            const powerBarWrap = document.createElement('div');
            powerBarWrap.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:160px;height:14px;background:#333;border-radius:8px;overflow:hidden;display:none;z-index:10;';
            powerBarWrap.id = 'power-bar-wrap';
            const powerBar = document.createElement('div');
            powerBar.id = 'power-bar';
            powerBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff);border-radius:8px;transition:width 0.05s;position:relative;';
            
            const chicken = document.createElement('div');
            chicken.innerText = '🐔';
            chicken.style.cssText = 'position:absolute;right:-15px;top:50%;transform:translateY(-50%);font-size:24px;filter:drop-shadow(2px 2px 2px rgba(0,0,0,0.3));';
            powerBar.appendChild(chicken);
            
            powerBarWrap.appendChild(powerBar);
            container.style.position = 'relative';
            container.appendChild(powerBarWrap);

            // 燈光
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); basketScene.add(ambientLight);
            const spotLight = new THREE.SpotLight(0xffffff, 1.2);
            spotLight.position.set(0, 20, 5); spotLight.castShadow = true;
            spotLight.angle = Math.PI / 4; spotLight.penumbra = 0.3;
            basketScene.add(spotLight);
            const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
            fillLight.position.set(-5, 5, 10); basketScene.add(fillLight);

            // === 木質地板（用 Canvas 紋理）===
            const floorCanvas = document.createElement('canvas');
            floorCanvas.width = 512; floorCanvas.height = 512;
            const fc = floorCanvas.getContext('2d');
            fc.fillStyle = '#c8a96e'; fc.fillRect(0, 0, 512, 512);
            fc.strokeStyle = '#a07840'; fc.lineWidth = 2;
            for (let i = 0; i < 512; i += 32) { fc.beginPath(); fc.moveTo(i, 0); fc.lineTo(i, 512); fc.stroke(); }
            const floorTex = new THREE.CanvasTexture(floorCanvas);
            floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
            floorTex.repeat.set(4, 4);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ map: floorTex }));
            floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; basketScene.add(floor);

            // === 場地線條 ===
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            // 三分線（圓弧）
            const arcGeo = new THREE.TorusGeometry(5, 0.05, 8, 60, Math.PI);
            const arc = new THREE.Mesh(arcGeo, lineMat);
            arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.02, 3); basketScene.add(arc);
            // 中線
            const midLine = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.1), lineMat);
            midLine.rotation.x = -Math.PI / 2; midLine.position.set(0, 0.02, 8); basketScene.add(midLine);

            // === 背景牆（觀眾席）===
            // 後牆
            const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshLambertMaterial({ color: 0xc8dce8 }));
            backWall.position.set(0, 8, -5); basketScene.add(backWall);
            // 左右牆
            const sideWallGeo = new THREE.PlaneGeometry(20, 16);
            const sideWallMat = new THREE.MeshLambertMaterial({ color: 0xd8e8f0, side: THREE.DoubleSide });
            const lWall = new THREE.Mesh(sideWallGeo, sideWallMat);
            lWall.rotation.y = Math.PI / 2; lWall.position.set(-10, 8, 5); basketScene.add(lWall);
            const rWall = new THREE.Mesh(sideWallGeo, sideWallMat);
            rWall.rotation.y = -Math.PI / 2; rWall.position.set(10, 8, 5); basketScene.add(rWall);
            // 觀眾席
            for (let r = 0; r < 3; r++) {
                const seat = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 1.5), new THREE.MeshLambertMaterial({ color: [0xff6b6b, 0x74b9ff, 0x55efc4][r] }));
                seat.position.set(0, r * 1.2 + 0.2, -4.5 - r * 1.5); basketScene.add(seat);
            }

            // === 精緻籃框 ===
            backboard = new THREE.Group();

            // 支柱
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), new THREE.MeshLambertMaterial({ color: 0x888888 }));
            pole.position.set(0, 3, -0.3); backboard.add(pole);

            // 籃板（白色透明感）
            const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 0.15), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
            boardMesh.position.y = 6.5; boardMesh.castShadow = true; backboard.add(boardMesh);

            // 籃板框線（橘色外框）
            const boardFrame = new THREE.LineSegments(
                new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 3.2, 0.15)),
                new THREE.LineBasicMaterial({ color: 0xff5722, linewidth: 2 })
            );
            boardFrame.position.y = 6.5; backboard.add(boardFrame);

            // 籃板內小方框（投籃瞄準框）
            const innerFrame = new THREE.LineSegments(
                new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 1.2, 0.1)),
                new THREE.LineBasicMaterial({ color: 0xff5722 })
            );
            innerFrame.position.set(0, 6.0, 0.05); backboard.add(innerFrame);

            // 籃框（紅色圓環）
            const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 16, 60), new THREE.MeshLambertMaterial({ color: 0xff3d00 }));
            rim.rotation.x = Math.PI / 2; rim.position.set(0, 5.2, 1.2); backboard.add(rim);

            // 籃網（用多條細線模擬）
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const netGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(Math.cos(angle) * 1.1, 0, Math.sin(angle) * 1.1),
                    new THREE.Vector3(Math.cos(angle) * 0.5, -1.2, Math.sin(angle) * 0.5),
                ]);
                const net = new THREE.Line(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
                net.position.set(0, 5.2, 1.2); backboard.add(net);
            }

            backboard.position.z = 0;
            basketScene.add(backboard);

            // === 雞哥（主角）===
            playerRooster = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
            body.position.y = 0.9; body.castShadow = true; playerRooster.add(body);
            const comb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0xff5252 }));
            comb.position.set(0, 2.0, 0); playerRooster.add(comb);
            const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), new THREE.MeshLambertMaterial({ color: 0xff9800 }));
            beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.2, 0.7); playerRooster.add(beak);
            playerRooster.position.set(0, 0, 12);
            basketScene.add(playerRooster);

            container.addEventListener('mousedown', (e) => {
                if (basketTimeUp) return;
                chargeStart = performance.now(); isCharging = true;
                document.getElementById('power-bar-wrap').style.display = 'block';
            });
            container.addEventListener('mouseup', (e) => {
                if (!isCharging || basketTimeUp) return;
                isCharging = false;
                const charged = Math.min((performance.now() - chargeStart) / 1000, 1);
                document.getElementById('power-bar-wrap').style.display = 'none';
                document.getElementById('power-bar').style.width = '0%';
                throwBall(charged);
            });

            // 手機觸控支援
            container.addEventListener('touchstart', (e) => {
                if (basketTimeUp) return;
                e.preventDefault(); // 防止滾動
                chargeStart = performance.now(); isCharging = true;
                document.getElementById('power-bar-wrap').style.display = 'block';
            }, { passive: false });

            container.addEventListener('touchend', (e) => {
                if (!isCharging || basketTimeUp) return;
                e.preventDefault();
                isCharging = false;
                const charged = Math.min((performance.now() - chargeStart) / 1000, 1);
                document.getElementById('power-bar-wrap').style.display = 'none';
                document.getElementById('power-bar').style.width = '0%';
                throwBall(charged);
            }, { passive: false });
            animateBasket();
        }
        resetBasket();
    }





    // 用 Canvas 製作籃球紋理
    function createBasketballTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        // 橘色底
        ctx.fillStyle = '#e85d04';
        ctx.fillRect(0, 0, 256, 256);
        // 黑色弧線（模擬籃球縫線）
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        // 水平線
        ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
        // 垂直線
        ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
        // 左弧線
        ctx.beginPath(); ctx.arc(128, 128, 90, -Math.PI*0.4, Math.PI*0.4); ctx.stroke();
        // 右弧線
        ctx.beginPath(); ctx.arc(128, 128, 90, Math.PI*0.6, Math.PI*1.4); ctx.stroke();
        return new THREE.CanvasTexture(canvas);
    }
    const ballTexture = createBasketballTexture();


    function throwBall(power = 0.6) {
        if (basketTimeUp) return;
        
        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 32, 32),
            new THREE.MeshLambertMaterial({ map: ballTexture }) // 套用籃球紋理
        );
        ball.castShadow = true;
        
        ball.position.copy(playerRooster.position);
        ball.position.y += 2;
        
        const speedY = isMobile ? (0.3 + power * 0.4) : (0.2 + power * 0.25);
        
        // 算出從雞哥位置到籃框的向量
        const dx = backboard.position.x - playerRooster.position.x;
        const dz = backboard.position.z - playerRooster.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        // 依據距離決定平飛的速度
        const speedXZ = isMobile ? ((0.15 + power * 0.25) * (dist / 10)) : ((0.1 + power * 0.15) * (dist / 10));
        
        ball.userData = { 
            velocity: new THREE.Vector3((dx / dist) * speedXZ, speedY, (dz / dist) * speedXZ),
            gravity: isMobile ? -0.02 : -0.012,
            isScored: false,
            hasMissed: false
        };
        
        basketScene.add(ball);
        balls.push(ball);
    }

    function animateBasket() {
        requestAnimationFrame(animateBasket);
        
        if (!basketTimeUp) {
            // 大世界操控：用鍵盤 WASD 或方向鍵移動雞哥
            const speed = isMobile ? 0.3 : 0.15;
            if (window.basketKeys.w || window.basketKeys.ArrowUp) playerRooster.position.z -= speed;
            if (window.basketKeys.s || window.basketKeys.ArrowDown) playerRooster.position.z += speed;
            if (window.basketKeys.a || window.basketKeys.ArrowLeft) playerRooster.position.x -= speed;
            if (window.basketKeys.d || window.basketKeys.ArrowRight) playerRooster.position.x += speed;

            // 限制移動範圍在球場內
            playerRooster.position.x = Math.max(-12, Math.min(12, playerRooster.position.x));
            playerRooster.position.z = Math.max(3, Math.min(15, playerRooster.position.z));

            // 更新蓄力條
            if (isCharging && chargeStart) {
                const pct = Math.min((performance.now() - chargeStart) / 1000 * 100, 100);
                const bar = document.getElementById('power-bar');
                if (bar) bar.style.width = pct + '%';
            }
        }

        // 反向迴圈以便安全刪除陣列元素
        for (let idx = balls.length - 1; idx >= 0; idx--) {
            let ball = balls[idx];
            ball.userData.velocity.y += ball.userData.gravity;
            ball.position.add(ball.userData.velocity);
            
            // 籃球滾動動畫（依據速度旋轉）
            if (ball.position.y <= 0.8 && Math.abs(ball.userData.velocity.y) < 0.05) {
                ball.rotation.x += ball.userData.velocity.z * 1.5;
                ball.rotation.z -= ball.userData.velocity.x * 1.5;
            }

            // 籃板碰撞偵測（板子在 z=backboard.position.z，上面 y=8~12，x±3）
            const bz = backboard.position.z + 0.2;
            const bx = backboard.position.x;
            const hitBoard = ball.position.z <= bz &&
                             ball.position.z >= bz - 0.8 &&
                             Math.abs(ball.position.x - bx) < 3.5 &&
                             ball.position.y > 4.5 && ball.position.y < 8.5 && // 配合新高度
                             ball.userData.velocity.z < 0;

            if (hitBoard && !ball.userData.isScored) {
                ball.userData.velocity.z *= -0.5;  // 反彈，但力道減半
                ball.userData.velocity.x += (Math.random() - 0.5) * 0.05;
                ball.userData.velocity.y *= 0.3;
                // 碰板音效（短促低音）
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.connect(g); g.connect(audioCtx.destination);
                osc.type = 'sine'; osc.frequency.setValueAtTime(120, audioCtx.currentTime);
                g.gain.setValueAtTime(0.3, audioCtx.currentTime);
                g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
                osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            }

            // Goal Detection
            const hoopPos = new THREE.Vector3(backboard.position.x, 5, backboard.position.z + 1.2);
            const distToHoop = ball.position.distanceTo(hoopPos);
            if (!ball.userData.isScored && distToHoop < 1.3 && ball.userData.velocity.y < 0) {
                ball.userData.isScored = true;
                basketScore++;
                basketScoreDisplay.textContent = basketScore;
                playBasketScore(); // 隨機播放進球音效
                ball.material.color.set(0x4caf50);
            }

            // 地板碰撞與滾動邏輯
            if (ball.position.y <= 0.8) {
                ball.position.y = 0.8; // 確保不會穿過地板 (籃球半徑 0.8)
                
                // 如果是第一次撞擊地板且沒進球，播放 miss 音效
                if (!ball.userData.isScored && !ball.userData.hasMissed) {
                    ball.userData.hasMissed = true;
                    playBasketMiss();
                }

                // 垂直反彈（帶有能量耗損）
                ball.userData.velocity.y *= -0.6;
                // 若垂直彈力極小，直接貼地
                if (Math.abs(ball.userData.velocity.y) < 0.02) {
                    ball.userData.velocity.y = 0;
                    ball.userData.gravity = 0; // 停止受重力影響，避免不斷抖動
                }

                // 水平摩擦力（慢慢停下來）
                ball.userData.velocity.x *= 0.96;
                ball.userData.velocity.z *= 0.96;
            }

            // 若球滾太遠，則將其移除
            if (Math.abs(ball.position.x) > 30 || Math.abs(ball.position.z) > 40) {
                basketScene.remove(ball);
                balls.splice(idx, 1);
            }
        }

        basketRenderer.render(basketScene, basketCamera);
    }

    function resetBasket() {
        basketScore = 0; basketTimeLeft = 15; basketTimeUp = true;
        basketScoreDisplay.textContent = 0; basketTimeDisplay.textContent = 15; basketTimerBar.style.width = '100%';
        balls.forEach(b => basketScene.remove(b)); balls = [];
        if (typeof backboard !== 'undefined' && backboard) {
            backboard.position.x = 0;
        }
        hoopSpeed = 0.1;
        if (playerRooster) {
            playerRooster.position.set(0, 0, 12);
        }
    }

    function stopBasket() { basketTimeUp = true; clearInterval(basketTimerId); }

    basketStartBtn.addEventListener('click', () => {
        playSound('start');
        clearInterval(basketTimerId);
        resetBasket();
        basketTimeUp = false;
        basketTimerId = setInterval(() => {
            basketTimeLeft--; basketTimeDisplay.textContent = basketTimeLeft; basketTimerBar.style.width = `${(basketTimeLeft/15)*100}%`;
            if (basketTimeLeft <= 0) {
                stopBasket();
                
                // Show Time's Up Overlay
                const overlay = document.getElementById('times-up-overlay');
                if (overlay) overlay.style.display = 'flex';
                
                setTimeout(() => {
                    if (overlay) overlay.style.display = 'none';
                    let title = basketScore >= 5 ? '恭喜你得了 MVP！🏀' : '你個躺贏狗！🐕';
                    showGameOver(title, '你一共投進了：', basketScore);
                }, 1500);
            }
        }, 1000);
    });

    // --- Chicks Crossing 3D Logic ---
    let scene, camera, renderer, chick3D, crossingScore = 0, crossingTimeLeft = 30, crossingTimerId, crossingActive = false;
    let cars3D = [], carSpawnerId;

    // 自訂過馬路音效
    const crossingWalkSound = new Audio('Chiikawa.mp3');
    const crossingCrashSound = new Audio('chiikawa-crash.mp3');
    const crossingScoreSound = new Audio('score2.mp3');

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
                    crossingWalkSound.pause();
                    crossingWalkSound.currentTime = 0;
                    crossingCrashSound.currentTime = 0;
                    crossingCrashSound.play();
                    stopCrossing3D(); showGameOver('救援失敗！😵', '小雞在馬路上受傷了...', crossingScore);
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
    if (crossingStartBtn) {
        crossingStartBtn.addEventListener('click', () => {
            playSound('start'); resetCrossing3D(); crossingActive = true;
            carSpawnerId = setInterval(spawnCar3D, 800);
            crossingTimerId = setInterval(() => {
                crossingTimeLeft--; crossingTimeDisplay.textContent = crossingTimeLeft; crossingTimerBar.style.width = `${(crossingTimeLeft/30)*100}%`;
                if (crossingTimeLeft <= 0) { stopCrossing3D(); showGameOver('救援時間結束！🏁', '你成功救出的次數：', crossingScore); }
            }, 1000);
        });
    }
    if (crossing3DContainer) {
        const handleCrossingJump = () => {
            if (!crossingActive) return; 
            
            crossingWalkSound.pause();
            crossingWalkSound.currentTime = 0;
            crossingWalkSound.play().catch(e => console.log("Audio play blocked:", e));
            
            chick3D.position.z -= 1;
            if (chick3D.position.z < -14) { 
                crossingScore++; 
                crossingScoreDisplay.textContent = crossingScore; 
                crossingScoreSound.currentTime = 0;
                crossingScoreSound.play().catch(e => console.log("Audio play blocked:", e));
                chick3D.position.z = 4; 
            }
        };

        crossing3DContainer.addEventListener('mousedown', (e) => {
            handleCrossingJump();
        });

        crossing3DContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleCrossingJump();
        }, { passive: false });
    }
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && crossingView && crossingView.classList && crossingView.classList.contains('active')) {
            if (crossing3DContainer) crossing3DContainer.dispatchEvent(new Event('mousedown'));
        }
    });

    // --- Modal ---
    function showGameOver(title, msg, val) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-msg').textContent = msg;
        document.getElementById('final-score-val').textContent = val;
        modal.style.display = 'flex'; // 強制顯示介面
        modal.classList.add('visible');
    }
    // --- Modal Logic ---
    window.handleRestart = () => {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        if (moleGameView.classList.contains('active')) {
            initMole3D();
            moleStartBtn.click();
        } else if (memoryGameView.classList.contains('active')) {
            basketStartBtn.click();
        } else if (crossingView.classList.contains('active')) {
            if (crossingStartBtn) crossingStartBtn.click();
        }
    };

    window.handleGoLobby = () => {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        showView('lobby');
    };
});
