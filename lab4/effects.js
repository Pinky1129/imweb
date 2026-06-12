// effects.js - 處理 6 種視覺特效
class EffectManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.currentEffect = 'slime';
        this.particles = [];
        this.lastTime = 0;
        
        // Fluid simulation data
        this.fluidGrid = [];
        
        // Water ripples data
        this.rippleMap = [];
        this.rippleMap2 = [];
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.initEffect(this.currentEffect);
    }

    setEffect(effectName) {
        this.currentEffect = effectName;
        this.particles = [];
        this.fishes = [];
        this.ctx.clearRect(0, 0, this.width, this.height); // Always clear when switching
        this.initEffect(effectName);
    }

    initEffect(effectName) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (effectName === 'cherry') {
            for (let i = 0; i < 150; i++) {
                this.particles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: Math.random() * 2 - 1,
                    vy: Math.random() * 2 + 1,
                    size: Math.random() * 10 + 5,
                    angle: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 0.1
                });
            }
        } else if (effectName === 'snow') {
            for (let i = 0; i < 300; i++) {
                this.particles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 1,
                    vy: Math.random() * 2 + 1,
                    size: Math.random() * 3 + 1,
                    angle: Math.random() * Math.PI * 2
                });
            }
        } else if (effectName === 'fireflies') {
            for (let i = 0; i < 100; i++) {
                this.particles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 4 + 2,
                    blinkOffset: Math.random() * Math.PI * 2
                });
            }
        } else if (effectName === 'ripples') {
            this.fishes = [];
            for (let i = 0; i < 12; i++) {
                this.fishes.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    targetX: Math.random() * this.width,
                    targetY: Math.random() * this.height,
                    size: Math.random() * 10 + 15,
                    depth: 1.0,
                    scared: 0
                });
            }
        } else if (effectName === 'fluid') {
            // Setup beautiful flowing ribbons instead of simple dots
            const colors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#fdcbf1'];
            for(let i=0; i<5; i++){
                this.particles.push({
                    color: colors[i],
                    offset: (i - 2) * 20, // Offset spread from hand center
                    phase: i * Math.PI / 2,
                    thickness: Math.random() * 20 + 30,
                    prevX: -1000,
                    prevY: -1000,
                    followSpeed: 0.18 + Math.random() * 0.08 // Faster lag, still silky
                });
            }
        }
    }

    update(handX, handY, handVX, handVY, isHandOpen, isHandClosed) {
        if (this.currentEffect === 'slime') {
            this.ctx.clearRect(0, 0, this.width, this.height);
            return; // Handled by DOM
        }

        // Clear or fade canvas depending on effect
        if (this.currentEffect === 'fireworks') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.currentEffect === 'fluid') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; // Smooth white fade for fluid trails
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.currentEffect === 'fireflies') {
            this.ctx.fillStyle = 'rgba(10, 15, 30, 0.3)'; // Dark night sky
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.currentEffect === 'snow') {
            this.ctx.fillStyle = '#000000'; // Black background for snow
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        const hx = handX;
        const hy = handY;

        if (this.currentEffect === 'cherry') this.updateCherry(hx, hy, handVX, handVY);
        if (this.currentEffect === 'snow') this.updateSnow(hx, hy, handVX, handVY, isHandClosed);
        if (this.currentEffect === 'fireflies') this.updateFireflies(hx, hy, isHandOpen, isHandClosed);
        if (this.currentEffect === 'fireworks') this.updateFireworks(hx, hy, handVX, handVY, isHandOpen);
        if (this.currentEffect === 'fluid') this.updateFluid(hx, hy, handVX, handVY);
        if (this.currentEffect === 'ripples') this.updateRipples(hx, hy, handVX, handVY);
    }

    // --- 1. 櫻花 ---
    updateCherry(hx, hy, hvx, hvy) {
        this.ctx.fillStyle = '#ffb7c5';
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.spin;

            // Hand interaction
            let dx = p.x - hx;
            let dy = p.y - hy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 150) {
                p.vx += (dx / dist) * 2 + hvx * 0.1;
                p.vy += (dy / dist) * 2 + hvy * 0.1;
            }

            // Resistance
            p.vx *= 0.95;
            if (p.vy > 3) p.vy *= 0.95;

            // Reset if out of bounds
            if (p.y > this.height + 20) {
                p.y = -20;
                p.x = Math.random() * this.width;
                p.vx = Math.random() * 2 - 1;
                p.vy = Math.random() * 2 + 1;
            }
            if (p.x < -20) p.x = this.width + 20;
            if (p.x > this.width + 20) p.x = -20;

            // Draw petal
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.angle);
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.bezierCurveTo(p.size/2, -p.size/2, p.size, -p.size/3, 0, p.size);
            this.ctx.bezierCurveTo(-p.size, -p.size/3, -p.size/2, -p.size/2, 0, 0);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    // --- 2. 下雪 ---
    updateSnow(hx, hy, hvx, hvy, isHandClosed) {
        this.ctx.fillStyle = '#ffffff';
        this.particles.forEach(p => {
            p.x += p.vx + Math.sin(p.angle) * 0.5;
            p.y += p.vy;
            p.angle += 0.05;

            let dx = p.x - hx;
            let dy = p.y - hy;
            let dist = Math.sqrt(dx*dx + dy*dy);

            if (isHandClosed && dist < 300) {
                // Attract to hand (Snowstorm ball)
                p.vx -= (dx / dist) * 1.5;
                p.vy -= (dy / dist) * 1.5;
            } else if (dist < 100) {
                // Push away
                p.vx += (dx / dist) * 2;
                p.vy += (dy / dist) * 2;
            }

            p.vx *= 0.98;
            if (p.vy > 5) p.vy *= 0.98;

            if (p.y > this.height) {
                p.y = -10;
                p.x = Math.random() * this.width;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    // --- 3. 螢火蟲 ---
    updateFireflies(hx, hy, isHandOpen, isHandClosed) {
        let time = Date.now() * 0.003;
        this.particles.forEach(p => {
            // Wandering
            p.vx += (Math.random() - 0.5) * 0.5;
            p.vy += (Math.random() - 0.5) * 0.5;
            
            p.x += p.vx;
            p.y += p.vy;

            let dx = p.x - hx;
            let dy = p.y - hy;
            let dist = Math.sqrt(dx*dx + dy*dy);

            if (isHandClosed && dist < 400) {
                p.vx -= (dx / dist) * 0.8;
                p.vy -= (dy / dist) * 0.8;
            } else if (isHandOpen && dist < 200) {
                p.vx += (dx / dist) * 3;
                p.vy += (dy / dist) * 3;
            } else if (dist < 100) {
                p.vx += (dx / dist) * 1;
                p.vy += (dy / dist) * 1;
            }

            p.vx *= 0.9;
            p.vy *= 0.9;

            if (p.x < 0) p.x = this.width;
            if (p.x > this.width) p.x = 0;
            if (p.y < 0) p.y = this.height;
            if (p.y > this.height) p.y = 0;

            let glow = (Math.sin(time + p.blinkOffset) + 1) / 2; // 0 to 1
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(200, 255, 100, ${glow})`;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#c8ff64';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    // --- 4. 煙火 ---
    updateFireworks(hx, hy, hvx, hvy, isHandOpen) {
        // Leave sparks from hand
        if (hx > 0 && Math.abs(hvx) + Math.abs(hvy) > 5) {
            for(let i=0; i<3; i++){
                this.particles.push({
                    x: hx + (Math.random()-0.5)*20,
                    y: hy + (Math.random()-0.5)*20,
                    vx: hvx * 0.2 + (Math.random()-0.5)*5,
                    vy: hvy * 0.2 + (Math.random()-0.5)*5,
                    life: 1.0,
                    color: `hsl(${Math.random()*30 + 35}, 100%, 60%)`, // Golden/Yellow sparks
                    type: 'spark'
                });
            }
        }

        // Explode if open hand fast
        if (isHandOpen && !this.wasHandOpen && hx > 0) {
            for(let i=0; i<80; i++){
                let angle = Math.random() * Math.PI * 2;
                let speed = Math.random() * 15 + 5;
                this.particles.push({
                    x: hx, y: hy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    color: `hsl(${Math.random()*20 + 45}, 100%, 60%)`, // Bright yellow explosion
                    type: 'explode'
                });
            }
        }
        this.wasHandOpen = isHandOpen;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravity
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.type==='spark'?3:4, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color.replace(')', `, ${p.life})`);
            this.ctx.fill();
        }
    }

    // --- 5. 彩色流體 (Beautiful Ribbon Trails) ---
    updateFluid(hx, hy, hvx, hvy) {
        this.ctx.globalCompositeOperation = 'multiply'; // Vibrant ink blending on white
        
        const speed = Math.sqrt(hvx * hvx + hvy * hvy);
        const time = Date.now() * 0.003;

        this.particles.forEach(ribbon => {
            if (hx < 0) {
                ribbon.prevX = -1000;
                return;
            }

            let swayX = Math.cos(time + ribbon.phase) * ribbon.offset;
            let swayY = Math.sin(time + ribbon.phase) * ribbon.offset;
            let targetX = hx + swayX;
            let targetY = hy + swayY;

            if (ribbon.prevX === -1000) {
                ribbon.prevX = targetX;
                ribbon.prevY = targetY;
            }

            // Easing / lagging effect so it doesn't snap instantly to hand
            let nextX = ribbon.prevX + (targetX - ribbon.prevX) * ribbon.followSpeed;
            let nextY = ribbon.prevY + (targetY - ribbon.prevY) * ribbon.followSpeed;

            // Draw smooth segment
            this.ctx.beginPath();
            this.ctx.moveTo(ribbon.prevX, ribbon.prevY);
            
            // Calculate a control point for a slight curve
            let cpX = ribbon.prevX + (nextX - ribbon.prevX) * 0.5 + Math.cos(time)*15;
            let cpY = ribbon.prevY + (nextY - ribbon.prevY) * 0.5 + Math.sin(time)*15;
            this.ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
            
            this.ctx.strokeStyle = ribbon.color;
            this.ctx.lineWidth = ribbon.thickness + Math.min(speed * 0.8, 30);
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();

            ribbon.prevX = nextX;
            ribbon.prevY = nextY;
        });
        
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // --- 6. 水波紋與小魚 (Ripples & Fishes) ---
    updateRipples(hx, hy, hvx, hvy) {
        this.ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Update & Draw Fishes
        if (this.fishes) {
            this.fishes.forEach(fish => {
                let dxHand = fish.x - hx;
                let dyHand = fish.y - hy;
                let distHand = Math.sqrt(dxHand * dxHand + dyHand * dyHand);

                // Scared by hand
                if (distHand < 150 && hx > 0) {
                    fish.scared = 60; // 60 frames of being scared
                    let angle = Math.atan2(dyHand, dxHand);
                    fish.vx += Math.cos(angle) * 2;
                    fish.vy += Math.sin(angle) * 2;
                }

                if (fish.scared > 0) {
                    fish.scared--;
                    fish.depth += (0.3 - fish.depth) * 0.1; // Dive deep (shrink and fade)
                    fish.vx *= 0.95;
                    fish.vy *= 0.95;
                } else {
                    fish.depth += (1.0 - fish.depth) * 0.05; // Surface slowly
                    
                    // Wander to target
                    let dxTarget = fish.targetX - fish.x;
                    let dyTarget = fish.targetY - fish.y;
                    if (Math.abs(dxTarget) < 50 && Math.abs(dyTarget) < 50) {
                        fish.targetX = Math.random() * this.width;
                        fish.targetY = Math.random() * this.height;
                    }
                    let angle = Math.atan2(dyTarget, dxTarget);
                    fish.vx += Math.cos(angle) * 0.05;
                    fish.vy += Math.sin(angle) * 0.05;
                    
                    // Normal swim speed limit
                    let speed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
                    if (speed > 1.5) {
                        fish.vx = (fish.vx / speed) * 1.5;
                        fish.vy = (fish.vy / speed) * 1.5;
                    }
                }

                fish.x += fish.vx;
                fish.y += fish.vy;
                
                // Screen wrap
                if (fish.x < -50) fish.x = this.width + 50;
                if (fish.x > this.width + 50) fish.x = -50;
                if (fish.y < -50) fish.y = this.height + 50;
                if (fish.y > this.height + 50) fish.y = -50;

                // Draw Koi Fish
                this.ctx.save();
                this.ctx.translate(fish.x, fish.y);
                this.ctx.rotate(Math.atan2(fish.vy, fish.vx));
                this.ctx.scale(fish.depth, fish.depth);
                this.ctx.globalAlpha = fish.depth;
                
                // Shadow for depth
                this.ctx.shadowColor = 'rgba(0, 50, 100, 0.4)';
                this.ctx.shadowBlur = 15 * fish.depth;
                this.ctx.shadowOffsetX = 10 * fish.depth;
                this.ctx.shadowOffsetY = 10 * fish.depth;

                this.ctx.fillStyle = '#ff6b6b'; // Coral/Orange body
                
                // Body
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, fish.size, fish.size * 0.4, 0, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Tail
                this.ctx.beginPath();
                this.ctx.moveTo(-fish.size + 2, 0);
                this.ctx.lineTo(-fish.size - 12, -10);
                this.ctx.lineTo(-fish.size - 12, 10);
                this.ctx.fill();

                this.ctx.restore();
            });
        }

        // Hand Ripples
        if (Math.abs(hvx) + Math.abs(hvy) > 3) {
            this.particles.push({
                x: hx, y: hy, radius: 1, alpha: 1.0
            });
        }

        this.ctx.lineWidth = 3;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.radius += 5;
            p.alpha -= 0.02;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius * 0.8, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(150, 200, 255, ${p.alpha * 0.3})`;
            this.ctx.stroke();
        }
    }
}
window.EffectManager = EffectManager;
