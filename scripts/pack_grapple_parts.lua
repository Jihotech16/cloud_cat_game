-- Crop and nearest-neighbor pack generated art; no procedural illustration.
local root='resources/cat-grapple/'
for _,part in ipairs({'hook','rope'}) do
  local src=Image{fromFile=root..part..'-source-v1.png'}
  local l,r,t,b=src.width-1,0,src.height-1,0
  for y=0,src.height-1 do for x=0,src.width-1 do
    if app.pixelColor.rgbaA(src:getPixel(x,y))>128 then
      l=math.min(l,x);r=math.max(r,x);t=math.min(t,y);b=math.max(b,y)
    end
  end end
  assert(r>l and b>t,'Empty source')
  local w,h=32,32
  local dw,dh,dx,dy
  if part=='rope' then
    -- Keep four braid repeats instead of compressing the entire long strip.
    l=math.floor(src.width*0.4);r=l+math.floor(src.width*0.2)-1
    h=8;dw=32;dh=6;dx=0;dy=1
  else
    local scale=28/math.max(r-l+1,b-t+1)
    dw=math.floor((r-l+1)*scale+0.5);dh=math.floor((b-t+1)*scale+0.5)
    dx=math.floor((w-dw)/2);dy=math.floor((h-dh)/2)
  end
  local out=Image(w,h,ColorMode.RGB);out:clear()
  for y=0,dh-1 do for x=0,dw-1 do
    local sx=l+math.floor((x+0.5)*(r-l+1)/dw)
    local sy=t+math.floor((y+0.5)*(b-t+1)/dh)
    out:drawPixel(dx+x,dy+y,src:getPixel(math.min(r,sx),math.min(b,sy)))
  end end
  out:saveAs(root..part..'-v1.png')
  local sprite=Sprite(w,h,ColorMode.RGB)
  sprite:newCel(sprite.layers[1],1,out,Point(0,0))
  sprite:saveAs(root..part..'-v1.aseprite')
  print(part..': '..w..'x'..h)
end
