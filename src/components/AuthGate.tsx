"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in"|"up">("in");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    setErr("");
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw });
    if (error) setErr(error.message);
    else if (mode === "up") setErr("Check your email to confirm, then sign in.");
  }

  if (!ready) return <div style={{display:"grid",placeItems:"center",height:"100vh",color:"var(--muted)"}}>Loading…</div>;
  if (session) return <>{children}</>;

  return (
    <div style={{display:"grid",placeItems:"center",minHeight:"100vh",padding:20}}>
      <div className="card" style={{width:"100%",maxWidth:400,padding:28}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <div style={{width:32,height:32,borderRadius:7,background:"var(--accent)",display:"grid",placeItems:"center"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 21v-6h6v6"/></svg>
          </div>
          <div style={{fontWeight:700,fontSize:16}}>ProSight <span style={{color:"var(--muted)",fontWeight:500}}>Studio</span></div>
        </div>
        <h1 style={{fontSize:18,margin:"0 0 4px"}}>{mode==="in"?"Sign in":"Create your account"}</h1>
        <p style={{fontSize:13,color:"var(--muted)",margin:"0 0 18px"}}>Your reports, saved to your account.</p>
        <div style={{marginBottom:12}}><input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div style={{marginBottom:12}}><input className="input" type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
        {err && <div style={{fontSize:12.5,color:"var(--danger)",marginBottom:12}}>{err}</div>}
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={submit}>{mode==="in"?"Sign in":"Sign up"}</button>
        <div style={{fontSize:13,color:"var(--muted)",marginTop:14,textAlign:"center"}}>
          {mode==="in" ? <>No account? <a onClick={()=>{setMode("up");setErr("");}} style={{color:"var(--accent-2)",cursor:"pointer",fontWeight:600}}>Sign up</a></>
                       : <>Have an account? <a onClick={()=>{setMode("in");setErr("");}} style={{color:"var(--accent-2)",cursor:"pointer",fontWeight:600}}>Sign in</a></>}
        </div>
      </div>
    </div>
  );
}
