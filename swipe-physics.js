/* Distance-based drawer physics. Velocity never commits a destructive action. */
(function(root){
  const width=132,resistance=0.54,threshold=58,hysteresis=14;
  function exposure(raw){const value=Math.max(0,raw*resistance);return value<=width?value:width+18*(1-Math.exp(-(value-width)/54));}
  function shouldOpen(exposed){return exposed>=threshold;}
  const api=Object.freeze({width,resistance,threshold,hysteresis,exposure,shouldOpen});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.historySwipePhysics=api;
})(globalThis);
