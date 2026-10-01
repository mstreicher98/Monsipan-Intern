/** Kurzer Piepton über Web Audio – keine Audiodateien nötig */
let ctx: AudioContext | null = null;

/** Muss einmal aus einer Nutzeraktion heraus laufen (iOS) */
export function unlockAudio() {
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
	} catch {
		ctx = null;
	}
}

function tone(freq: number, ms: number, when = 0, gain = 0.08) {
	if (!ctx) return;
	const t = ctx.currentTime + when;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + ms / 1000 + 0.02);
}

export function feedbackSuccess() {
	unlockAudio();
	tone(1320, 90);
	navigator.vibrate?.(35);
}

export function feedbackError() {
	unlockAudio();
	tone(330, 140);
	tone(250, 180, 0.15);
	navigator.vibrate?.([60, 60, 60]);
}

export function feedbackSaved() {
	unlockAudio();
	tone(880, 80);
	tone(1320, 110, 0.09);
	navigator.vibrate?.(20);
}
