const SOURCES={
"35344026":"https://images.pexels.com/photos/35344026/pexels-photo-35344026.jpeg?auto=compress&cs=tinysrgb&w=480",
"35344027":"https://images.pexels.com/photos/35344027/pexels-photo-35344027.jpeg?auto=compress&cs=tinysrgb&w=480",
"35344028":"https://images.pexels.com/photos/35344028/pexels-photo-35344028.jpeg?auto=compress&cs=tinysrgb&w=480",
"35263629":"https://images.pexels.com/photos/35263629/pexels-photo-35263629.jpeg?auto=compress&cs=tinysrgb&w=480",
"35463006":"https://images.pexels.com/photos/35463006/pexels-photo-35463006.jpeg?auto=compress&cs=tinysrgb&w=480",
"35263645":"https://images.pexels.com/photos/35263645/pexels-photo-35263645.jpeg?auto=compress&cs=tinysrgb&w=480",
"12471934":"https://images.pexels.com/photos/12471934/pexels-photo-12471934.jpeg?auto=compress&cs=tinysrgb&w=480",
"19086285":"https://images.pexels.com/photos/19086285/pexels-photo-19086285.jpeg?auto=compress&cs=tinysrgb&w=480",
"2533266":"https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=480",
"15856345":"https://images.pexels.com/photos/15856345/pexels-photo-15856345.jpeg?auto=compress&cs=tinysrgb&w=480",
"5713317":"https://images.pexels.com/photos/5713317/pexels-photo-5713317.jpeg?auto=compress&cs=tinysrgb&w=480",
"20784496":"https://images.pexels.com/photos/20784496/pexels-photo-20784496.jpeg?auto=compress&cs=tinysrgb&w=480",
"35382849":"https://images.pexels.com/photos/35382849/pexels-photo-35382849.jpeg?auto=compress&cs=tinysrgb&w=480",
"18018268":"https://images.pexels.com/photos/18018268/pexels-photo-18018268.jpeg?auto=compress&cs=tinysrgb&w=480",
"8776814":"https://images.pexels.com/photos/8776814/pexels-photo-8776814.jpeg?auto=compress&cs=tinysrgb&w=480",
"8522569":"https://images.pexels.com/photos/8522569/pexels-photo-8522569.jpeg?auto=compress&cs=tinysrgb&w=480",
"28664773":"https://images.pexels.com/photos/28664773/pexels-photo-28664773.jpeg?auto=compress&cs=tinysrgb&w=480",
"14444882":"https://images.pexels.com/photos/14444882/pexels-photo-14444882.jpeg?auto=compress&cs=tinysrgb&w=480",
"2535913":"https://images.pexels.com/photos/2535913/pexels-photo-2535913.jpeg?auto=compress&cs=tinysrgb&w=480",
"8996004":"https://images.pexels.com/photos/8996004/pexels-photo-8996004.jpeg?auto=compress&cs=tinysrgb&w=480",
"8422407":"https://images.pexels.com/photos/8422407/pexels-photo-8422407.jpeg?auto=compress&cs=tinysrgb&w=480"
};
export default async function handler(req,res){
try{const {id,chunk}=req.query||{};const src=SOURCES[String(id||"")];if(!src)return res.status(400).json({error:"Unknown asset id"});const r=await fetch(src);if(!r.ok)return res.status(502).json({error:"Upstream image request failed",status:r.status});const ab=await r.arrayBuffer();const base64=Buffer.from(ab).toString("base64");const size=8000;const index=Math.max(0,Number.parseInt(String(chunk||0),10)||0);const total=Math.ceil(base64.length/size);return res.status(200).json({id:String(id),chunk:index,total,data:base64.slice(index*size,(index+1)*size)});}catch(e){return res.status(500).json({error:"Proxy error"})}
}