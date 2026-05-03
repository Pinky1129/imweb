const songData = [
    {
        title: "Beauty And A Beat",
        url: "music/song1.mp3",
        options: ["Beauty And A Beat", "Baby", "One Less Lonely Girl", "Favorite Girl"]
    },
    {
        title: "遇上你之前的我",
        url: "music/song2.mp3",
        options: ["遇上你之前的我", "泡沫", "光年之外", "句號"]
    },
    {
        title: "IF YOU",
        url: "music/song3.mp3",
        options: ["IF YOU", "LOSER", "BANG BANG BANG", "BLUE"]
    },
    {
        title: "50 Feet",
        url: "music/song4.mp3",
        options: ["50 Feet", "Ride", "Or Nah", "Kings & Queens"]
    }
];

class GuessSongGame {
    constructor() {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.songs = [];
        this.audio = document.getElementById('audio-player');
        this.disc = document.getElementById('disc');
        this.optionsContainer = document.getElementById('options-container');
        this.questionNumberEl = document.getElementById('question-number');
        this.currentScoreEl = document.getElementById('current-score');
        this.progressFill = document.getElementById('progress-fill');
        this.seekBar = document.getElementById('seek-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');
        this.tonearm = document.getElementById('tonearm');

        // Audio Context for sound effects
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Event listeners for seek bar
        this.seekBar.oninput = () => {
            const time = (this.seekBar.value / 100) * this.audio.duration;
            this.audio.currentTime = time;
        };

        this.audio.ontimeupdate = () => this.updateProgress();
        this.audio.onloadedmetadata = () => {
            this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
        };

        // Bubble effect logic
        this.lastBubbleTime = 0;
        const triggerBubbles = (e) => {
            const now = Date.now();
            if (now - this.lastBubbleTime > 50) {
                const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                if (clientX && clientY) {
                    this.createBubbles(clientX, clientY);
                    this.lastBubbleTime = now;
                }
            }
        };

        this.seekBar.addEventListener('mousedown', triggerBubbles);
        this.seekBar.addEventListener('touchstart', triggerBubbles);
        this.seekBar.addEventListener('input', triggerBubbles); // Also while dragging
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateProgress() {
        if (!this.audio.duration) return;
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.seekBar.value = progress;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    start() {
        // Reset game state
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.songs = this.shuffle([...songData]); // Shuffle songs
        this.showScreen('question-screen');
        this.updateUI();
        this.loadQuestion();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    loadQuestion() {
        const song = this.songs[this.currentQuestionIndex];
        this.audio.src = song.url;
        this.audio.currentTime = 0;
        
        // Play the music (handles promise to avoid browser play errors)
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                this.disc.classList.add('playing');
                this.tonearm.classList.add('playing');
            }).catch(error => {
                console.log("播放被攔截，請點擊頁面後再試");
                this.disc.classList.remove('playing');
            });
        }

        // Render options
        this.optionsContainer.innerHTML = '';
        const shuffledOptions = this.shuffle([...song.options]);
        
        shuffledOptions.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.onclick = (e) => this.handleAnswer(option, btn, e);
            this.optionsContainer.appendChild(btn);
        });

        this.updateUI();
    }

    createBubbles(x, y) {
        const bubbleEmojis = ['🫧'];
        for (let i = 0; i < 3; i++) {
            const b = document.createElement('div');
            b.className = 'bubble';
            b.textContent = bubbleEmojis[0];
            b.style.left = x + 'px';
            b.style.top = y + 'px';
            
            // Random horizontal drift
            const tx = (Math.random() - 0.5) * 100;
            b.style.setProperty('--tx', `${tx}px`);
            
            document.body.appendChild(b);
            setTimeout(() => b.remove(), 1500);
        }
    }

    createCatBurst(x, y, isCorrect) {
        const emojis = isCorrect ? ['😸', '😺', '😻', '✨', '💖', '⭐'] : ['😿', '🙀', '😿', '💢', '❓', '💨'];
        for (let i = 0; i < 10; i++) {
            const p = document.createElement('div');
            p.className = 'cat-particle';
            p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            
            // Random direction
            const tx = (Math.random() - 0.5) * 400;
            const ty = (Math.random() - 0.5) * 400;
            const rot = (Math.random() - 0.5) * 720;
            
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);
            p.style.setProperty('--rot', `${rot}deg`);
            
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 800);
        }
    }

    playFeedbackSound(isCorrect) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        if (isCorrect) {
            // "Ding-Ding" sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        } else {
            // "Buzzer" sound
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        }

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.3);
    }

    handleAnswer(selectedOption, button, e) {
        const song = this.songs[this.currentQuestionIndex];
        const isCorrect = selectedOption === song.title;

        // Trigger Cat Burst Effect!
        this.createCatBurst(e.clientX, e.clientY, isCorrect);

        // Play sound effect
        this.playFeedbackSound(isCorrect);

        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);

        if (isCorrect) {
            this.score += 25; // Adjusted for 4 songs
            button.classList.add('correct');
        } else {
            button.classList.add('wrong');
            // Crying cat effect on disc!
            this.disc.style.setProperty('--disc-emoji', '"😿"');
            this.disc.classList.add('shake');
            
            // Highlight correct one
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.textContent === song.title) btn.classList.add('correct');
            });

            // Reset after delay
            setTimeout(() => {
                this.disc.style.setProperty('--disc-emoji', '"🐱"');
                this.disc.classList.remove('shake');
            }, 1500);
        }

        // Stop music and disc
        this.audio.pause();
        this.disc.classList.remove('playing');
        this.tonearm.classList.remove('playing');

        // Next question or end
        setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.songs.length) {
                this.loadQuestion();
            } else {
                this.endGame();
            }
        }, 1500);
    }

    updateUI() {
        this.questionNumberEl.textContent = `第 ${this.currentQuestionIndex + 1} / ${this.songs.length} 題`;
        this.currentScoreEl.textContent = this.score;
        const progress = ((this.currentQuestionIndex) / this.songs.length) * 100;
        this.progressFill.style.width = `${progress}%`;
    }

    endGame() {
        this.showScreen('result-screen');
        document.getElementById('final-score').textContent = this.score;
        
        let message = "再接再厲！";
        if (this.score === 100) message = "天啊！你太有品味了！💯";
        else if (this.score >= 50) message = "不錯喔，聽力及格了！✨";
        
        document.getElementById('result-message').textContent = message;
    }
}

// Initialize game
const game = new GuessSongGame();
