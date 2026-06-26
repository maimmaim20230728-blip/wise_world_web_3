/*
 * Wise World - Audio Engine v2（Web Audio 合成のみ・音声ファイル不要・完全オフライン）
 * ----------------------------------------------------------------------------
 * v2: 明るく速いタイトル曲＋温かいクイズ曲。リッチに聞こえる工夫:
 *   - マスターにコンプレッサー（音をまとめて深く・クリップ防止）
 *   - 1音を2つのデチューンしたオシレーターで重ねる（厚み・広がり）
 *   - ステレオ定位（左右の広がり）／パッドにローパス（温かさ）
 *   - 合成ドラム（キック/ハイハット/スネア）でノリを出す
 * すべて合成なので容量はほぼ変わりません（音声ファイル0個）。
 *
 *   WiseAudio.unlock() / startBGM('title'|'play') / stopBGM()
 *   WiseAudio.sfx('tap'|'correct'|'wrong'|'exp'|'levelup'|'levelbig'|'fanfare')
 *   WiseAudio.toggleMute() / isMuted() / setMuted(bool) / state()
 * ----------------------------------------------------------------------------
 */
window.WiseAudio = (function(){
  "use strict";

  var ctx=null, master=null, comp=null, bgmGain=null, sfxGain=null;
  var muted=false, started=false, noiseBuf=null;
  var bgmTimer=null, curTrack=null, bgmBus=null;
  var MUTE_KEY="wiseworld3.muted.v1";

  var N={
    F2:87.31, G2:98.00, A2:110.00, C3:130.81, D3:146.83, E3:164.81,
    F3:174.61, G3:196.00, A3:220.00, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
    C6:1046.50, D6:1174.66, E6:1318.51
  };

  // コード（bass=低音名 / pad=中音の三和音 / arp=高音の三和音）
  var CHORDS={
    C: { bass:"C3", pad:["C4","E4","G4"], arp:["C5","E5","G5"] },
    G: { bass:"G2", pad:["G3","B3","D4"], arp:["G4","B4","D5"] },
    Am:{ bass:"A2", pad:["A3","C4","E4"], arp:["A4","C5","E5"] },
    F: { bass:"F2", pad:["F3","A3","C4"], arp:["F4","A4","C5"] }
  };

  var TRACKS={
    // タイトル：明るく元気（120BPM・10小節=20秒・ドラム入り）
    title:{
      bpm:120, bars:["C","G","Am","F","C","G","Am","F","C","G"],
      drums:true, pad:true, padPeak:0.05, bass:true, bassStyle:"bounce", bassPeak:0.14,
      arp:true, arpDiv:8, arpPeak:0.05, melPeak:0.17,
      melody:[
        [0,"G5",1],[1,"E5",1],[2,"C5",0.5],[2.5,"E5",0.5],[3,"G5",1],
        [4,"D5",1],[5,"G5",1],[6,"B5",1],[7,"G5",1],
        [8,"C6",1],[9,"A5",1],[10,"E5",0.5],[10.5,"G5",0.5],[11,"A5",1],
        [12,"A5",1],[13,"C6",1],[14,"A5",1],[15,"F5",1],
        [16,"G5",1],[17,"E5",1],[18,"C5",0.5],[18.5,"E5",0.5],[19,"G5",1],
        [20,"D5",1],[21,"G5",1],[22,"B5",1],[23,"D6",1],
        [24,"C6",1],[25,"A5",1],[26,"E5",0.5],[26.5,"G5",0.5],[27,"A5",1],
        [28,"A5",1],[29,"C6",1],[30,"A5",0.5],[30.5,"G5",0.5],[31,"F5",1],
        [32,"E5",1],[33,"G5",1],[34,"C6",1],[35,"G5",1],
        [36,"D6",1],[37,"B5",1],[38,"G5",2]
      ]
    },
    // クイズ・解説中：温かく安心（80BPM・8小節・ドラム無し・パッドで包む）
    play:{
      bpm:80, bars:["C","F","G","C","C","F","G","C"],
      drums:false, pad:true, padPeak:0.085, bass:true, bassStyle:"soft", bassPeak:0.07,
      arp:true, arpDiv:4, arpPeak:0.03, melPeak:0.10,
      melody:[
        [0,"E5",2],[2,"G5",2],
        [4,"A5",2],[6,"F5",2],
        [8,"D5",2],[10,"G5",2],
        [12,"E5",2],[14,"C5",2],
        [16,"G5",2],[18,"E5",2],
        [20,"A5",2],[22,"F5",2],
        [24,"D5",2],[26,"G5",2],
        [28,"E5",2],[30,"C5",2]
      ]
    }
  };

  try{ muted = localStorage.getItem(MUTE_KEY)==="1"; }catch(e){}

  function ensure(){
    if(ctx) return ctx;
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=muted?0:0.55;
    comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-18; comp.knee.value=24; comp.ratio.value=3; comp.attack.value=0.004; comp.release.value=0.22;
    master.connect(comp); comp.connect(ctx.destination);
    bgmGain=ctx.createGain(); bgmGain.gain.value=0.5; bgmGain.connect(master);
    sfxGain=ctx.createGain(); sfxGain.gain.value=0.6; sfxGain.connect(master);
    // ノイズ（ハイハット/スネア用）
    var len=Math.floor(ctx.sampleRate*0.5);
    noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=noiseBuf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    return ctx;
  }
  function unlock(){ if(!ensure()) return; if(ctx.state==="suspended") ctx.resume(); started=true; }

  /* ---- 1音（包絡線・任意でデチューン/ローパス/定位）---- */
  function play(freq, t, dur, o){
    o=o||{};
    var osc=ctx.createOscillator(); osc.type=o.type||"sine"; osc.frequency.value=freq;
    if(o.detune) osc.detune.value=o.detune;
    var g=ctx.createGain();
    var atk=(o.atk!=null?o.atk:0.012), peak=Math.max(0.0002,o.peak||0.2);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(peak, t+atk);
    if(o.sustain){
      var hold=t+Math.max(atk+0.002, dur-(o.rel||0.18));
      g.gain.setValueAtTime(peak, hold);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    osc.connect(g);
    var tail=g;
    if(o.filterHz){ var f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=o.filterHz; g.connect(f); tail=f; }
    var dest=o.target||bgmBus||bgmGain;
    if(o.pan && ctx.createStereoPanner){ var p=ctx.createStereoPanner(); p.pan.value=o.pan; tail.connect(p); p.connect(dest); }
    else tail.connect(dest);
    osc.start(t); osc.stop(t+dur+0.05);
  }
  // リードは2つ重ねて厚みを出す
  function lead(freq,t,dur,peak,pan){
    play(freq,t,dur,{type:"triangle", peak:peak, pan:pan, detune:-6});
    play(freq,t,dur,{type:"triangle", peak:peak*0.55, pan:pan, detune:8});
  }

  /* ---- 合成ドラム ---- */
  function kick(t,gp){
    var o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(48,t+0.11);
    g.gain.setValueAtTime(Math.max(0.0002,gp),t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    o.connect(g); g.connect(bgmBus||bgmGain); o.start(t); o.stop(t+0.2);
  }
  function noiseHit(t,gp,hp,dur){
    var s=ctx.createBufferSource(); s.buffer=noiseBuf;
    var f=ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=hp;
    var g=ctx.createGain(); g.gain.setValueAtTime(Math.max(0.0002,gp),t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(bgmBus||bgmGain); s.start(t); s.stop(t+dur+0.02);
  }
  function hat(t,gp){ noiseHit(t,gp,7000,0.04); }
  function snare(t,gp){ noiseHit(t,gp,1800,0.13); play(180,t,0.12,{type:"triangle",peak:gp*0.5}); }

  /* ---- 1ループぶんを予約 ---- */
  function layTrack(spec, start){
    var beat=60/spec.bpm;
    if(spec.drums){
      for(var i=0;i<spec.bars.length*4;i++){
        var tb=start+i*beat, be=i%4;
        kick(tb,0.55);
        hat(tb+beat*0.5,0.10);
        if(be===2) snare(tb,0.20);
      }
    }
    for(var b=0;b<spec.bars.length;b++){
      var ch=CHORDS[spec.bars[b]]; if(!ch) continue;
      var t0=start+b*4*beat;
      if(spec.pad){ ch.pad.forEach(function(nm){ play(N[nm], t0, 4*beat*0.98, {type:"sine", peak:spec.padPeak, atk:0.06, sustain:true, rel:0.5, filterHz:1500}); }); }
      if(spec.bass){
        var rf=N[ch.bass];
        if(spec.bassStyle==="soft"){
          play(rf, t0, 2*beat, {type:"sine", peak:spec.bassPeak, atk:0.05, sustain:true, rel:0.4});
          play(rf, t0+2*beat, 2*beat, {type:"sine", peak:spec.bassPeak, atk:0.05, sustain:true, rel:0.4});
        }else{
          for(var k=0;k<8;k++){ var f=(k%4===2)?rf*2:rf; play(f, t0+k*0.5*beat, beat*0.45, {type:"triangle", peak:spec.bassPeak}); }
        }
      }
      if(spec.arp){
        var div=spec.arpDiv||8, step=4/div;
        for(var a=0;a<div;a++){ var nm=ch.arp[a%3]; play(N[nm], t0+a*step*beat, step*beat*0.55, {type:"triangle", peak:spec.arpPeak, pan:(a%2?0.28:-0.28)}); }
      }
    }
    if(spec.melody){ spec.melody.forEach(function(m){ lead(N[m[1]], start+m[0]*beat, m[2]*beat*0.95, (m[3]||spec.melPeak), 0); }); }
  }

  function scheduleLoop(name, start){
    var spec=TRACKS[name]; if(!spec) return;
    layTrack(spec, start);
    var loopDur=spec.bars.length*4*(60/spec.bpm);
    bgmTimer=setTimeout(function(){ if(curTrack===name) scheduleLoop(name, start+loopDur); }, Math.max(80, loopDur*1000-200));
  }
  function startBGM(name){
    if(!ensure()) return;
    if(curTrack===name && bgmTimer) return;
    stopBGM();
    curTrack=name;
    // この再生セッション専用のバスを作る（切替時に旧曲の予約済み音符を確実に止めるため）
    bgmBus=ctx.createGain(); bgmBus.gain.value=1; bgmBus.connect(bgmGain);
    scheduleLoop(name, ctx.currentTime+0.1);
  }
  function stopBGM(){
    if(bgmTimer){ clearTimeout(bgmTimer); bgmTimer=null; }
    curTrack=null;
    // 旧バスを短くフェードしてからグラフから切り離す＝予約済みの音符ごと停止し、重なりを防ぐ
    var old=bgmBus; bgmBus=null;
    if(old && ctx){
      try{
        old.gain.cancelScheduledValues(ctx.currentTime);
        old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
        old.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12);
      }catch(e){}
      setTimeout(function(){ try{ old.disconnect(); }catch(e){} }, 220);
    }
  }

  /* ---- 効果音 ---- */
  function sfx(name){
    if(!ensure() || muted) return;
    if(ctx.state==="suspended") ctx.resume();
    var t=ctx.currentTime;
    switch(name){
      case "tap": play(660,t,0.07,{type:"sine",peak:0.4,target:sfxGain}); break;
      case "correct":
        play(N.C5,t,0.12,{type:"triangle",peak:0.4,target:sfxGain});
        play(N.E5,t+0.09,0.12,{type:"triangle",peak:0.4,target:sfxGain});
        play(N.G5,t+0.18,0.22,{type:"triangle",peak:0.45,target:sfxGain}); break;
      case "wrong":
        play(N.A4,t,0.16,{type:"sine",peak:0.35,target:sfxGain});
        play(N.F4,t+0.12,0.24,{type:"sine",peak:0.33,target:sfxGain}); break;
      case "exp":
        play(N.C5,t,0.06,{type:"triangle",peak:0.25,target:sfxGain});
        play(N.E5,t+0.05,0.06,{type:"triangle",peak:0.25,target:sfxGain});
        play(N.G5,t+0.10,0.06,{type:"triangle",peak:0.25,target:sfxGain});
        play(N.C6,t+0.15,0.10,{type:"triangle",peak:0.28,target:sfxGain}); break;
      case "levelup":
        play(N.C5,t,0.14,{type:"triangle",peak:0.4,target:sfxGain});
        play(N.E5,t+0.12,0.14,{type:"triangle",peak:0.4,target:sfxGain});
        play(N.G5,t+0.24,0.14,{type:"triangle",peak:0.42,target:sfxGain});
        play(N.C6,t+0.36,0.32,{type:"triangle",peak:0.5,target:sfxGain});
        play(N.G5,t+0.36,0.32,{type:"sine",peak:0.2,target:sfxGain}); break;
      case "levelbig": // 10の倍数：明るいファンファーレ＋最後に和音
        play(N.G5,t,0.12,{type:"triangle",peak:0.42,target:sfxGain});
        play(N.C6,t+0.11,0.12,{type:"triangle",peak:0.44,target:sfxGain});
        play(N.E6,t+0.22,0.12,{type:"triangle",peak:0.46,target:sfxGain});
        play(N.C6,t+0.34,0.45,{type:"triangle",peak:0.46,target:sfxGain});
        play(N.E6,t+0.34,0.45,{type:"triangle",peak:0.34,target:sfxGain});
        play(N.G5,t+0.34,0.45,{type:"sine",peak:0.22,target:sfxGain}); break;
      case "fanfare": // 99到達：勝利のファンファーレ（上昇＋大きな和音×2）
        play(N.C5,t,0.13,{type:"triangle",peak:0.42,target:sfxGain});
        play(N.E5,t+0.11,0.13,{type:"triangle",peak:0.42,target:sfxGain});
        play(N.G5,t+0.22,0.13,{type:"triangle",peak:0.44,target:sfxGain});
        play(N.C6,t+0.33,0.13,{type:"triangle",peak:0.46,target:sfxGain});
        play(N.E6,t+0.44,0.18,{type:"triangle",peak:0.48,target:sfxGain});
        play(N.C5,t+0.64,0.5,{type:"triangle",peak:0.3,target:sfxGain});
        play(N.E5,t+0.64,0.5,{type:"triangle",peak:0.28,target:sfxGain});
        play(N.G5,t+0.64,0.5,{type:"triangle",peak:0.28,target:sfxGain});
        play(N.C6,t+1.06,0.85,{type:"triangle",peak:0.4,target:sfxGain});
        play(N.E6,t+1.06,0.85,{type:"triangle",peak:0.3,target:sfxGain});
        play(N.G5,t+1.06,0.85,{type:"sine",peak:0.2,target:sfxGain});
        play(N.C5,t+1.06,0.85,{type:"sine",peak:0.18,target:sfxGain}); break;
    }
  }

  function setMuted(m){
    muted=!!m; try{ localStorage.setItem(MUTE_KEY, muted?"1":"0"); }catch(e){}
    if(master && ctx){ master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(muted?0.0:0.55, ctx.currentTime, 0.03); }
    return muted;
  }
  function toggleMute(){ return setMuted(!muted); }

  return {
    unlock:unlock, startBGM:startBGM, stopBGM:stopBGM, sfx:sfx,
    setMuted:setMuted, toggleMute:toggleMute,
    isMuted:function(){ return muted; },
    state:function(){ return { ctx: ctx?ctx.state:"none", started:started, muted:muted, track:curTrack }; }
  };
})();
