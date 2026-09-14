export const metadata = { title: "Offline — ProSight" };

export default function Offline() {
  return (
    <div style={{
      minHeight:"100vh", display:"grid", placeItems:"center", padding:24,
      background:"#070d16", color:"#eaf2fa",
      fontFamily:'"Inter","Helvetica Neue",Helvetica,Arial,sans-serif',
    }}>
      <div style={{ maxWidth:420, textAlign:"center" }}>
        <img src="/icons/icon-192.png" alt="" style={{ width:64, height:64, borderRadius:16, marginBottom:20 }} />
        <h1 style={{ fontFamily:'"Sora",sans-serif', fontSize:24, fontWeight:600, margin:"0 0 10px" }}>No connection</h1>
        <p style={{ fontSize:14.5, color:"#a8bbd0", lineHeight:1.7, margin:"0 0 22px" }}>
          Reports and photographs are stored online, so they need a connection to open.
          Anything you had already saved is safe — it is on the server, not on this device.
        </p>
        <a href="/" style={{
          display:"inline-block", padding:"12px 22px", borderRadius:10, textDecoration:"none",
          color:"#fff", fontWeight:600, fontSize:13.5,
          background:"linear-gradient(150deg,#1a6fa9,#134d78)",
        }}>Try again</a>
      </div>
    </div>
  );
}
