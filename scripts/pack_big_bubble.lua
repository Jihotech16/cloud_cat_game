-- Non-generative packing of ImageGen's twelve complete drawings.
local root='resources/cat-bubble'
local prefix=app.params['prefix'] or 'big-bubble'
local inside=prefix=='big-bubble-inside'
local popping=prefix=='big-bubble-pop' or prefix=='big-bubble-pop-surprised'
local jumpingOut=prefix=='big-bubble-jump-exit'
local rows=(popping or jumpingOut) and 2 or 3
local count=4*rows
local src=Image{fromFile=root..'/'..prefix..'-source-v1.png'}
local cw,ch=src.width/4,src.height/rows
local top,bottom=math.floor(ch)-1,0
local function orange(p)
  local r,g,b=app.pixelColor.rgbaR(p),app.pixelColor.rgbaG(p),app.pixelColor.rgbaB(p)
  return app.pixelColor.rgbaA(p)>128 and r>110 and r>g*1.1 and g>b*1.2
end
for y=0,math.floor(ch)-1 do for x=0,math.floor(cw)-1 do
  if orange(src:getPixel(x,y)) then top=math.min(top,y);bottom=math.max(bottom,y) end
end end
local left,right=math.floor(cw)-1,0
for y=top,math.floor(top+(bottom-top)*0.45) do for x=0,math.floor(cw)-1 do
  if orange(src:getPixel(x,y)) then left=math.min(left,x);right=math.max(right,x) end
end end
assert(right>left,'Cannot measure reference head')
-- Match the 64px head width of the established bubble-cat sprites.
-- Keep one scale across all frames and preserve their camera-space movement.
local scale=64/(right-left+1)
local size=math.ceil(math.max(cw,ch)*scale/16)*16
local sheet=Image(size*4,size*rows,ColorMode.RGB);sheet:clear()
local anim=Sprite(size,size,ColorMode.RGB)
local frames={}
local times={0.18,0.25,0.28,0.3,0.35,0.3,0.18,0.16,0.2,0.35,0.35,0.35}
if popping then times={0.6,0.12,0.08,0.08,0.1,0.12,0.15,0.5} end
if prefix=='big-bubble-pop-surprised' then times={0.6,0.12,0.1,0.16,0.14,0.14,0.15,0.5} end
if jumpingOut then times={0.6,0.18,0.09,0.1,0.12,0.14,0.16,0.45} end
for f=0,count-1 do
  local col,row=f%4,math.floor(f/4)
  local x0,y0=math.floor(col*cw),math.floor(row*ch)
  local x1,y1=math.floor((col+1)*cw)-1,math.floor((row+1)*ch)-1
  local shiftX,shiftY=0,0
  if popping then
    -- Align the cat, not disappearing bubble bounds. Leave foot articulation intact.
    local ot,ob=y1,y0
    for y=y0,y1 do for x=x0,x1 do
      if orange(src:getPixel(x,y)) then ot=math.min(ot,y);ob=math.max(ob,y) end
    end end
    local ol,orr=x1,x0
    for y=ot,math.floor(ot+(ob-ot)*0.45) do for x=x0,x1 do
      if orange(src:getPixel(x,y)) then ol=math.min(ol,x);orr=math.max(orr,x) end
    end end
    shiftX=(ol+orr)/2-x0-(left+right)/2
    shiftY=ot-y0-top
  end
  local img=Image(size,size,ColorMode.RGB);img:clear()
  local dx=(size-cw*scale)/2;local dy=(size-ch*scale)/2
  for y=0,size-1 do for x=0,size-1 do
    local sx=x0+math.floor((x-dx)/scale+shiftX);local sy=y0+math.floor((y-dy)/scale+shiftY)
    if sx>=x0 and sx<=x1 and sy>=y0 and sy<=y1 then img:drawPixel(x,y,src:getPixel(sx,sy)) end
  end end
  frames[f+1]=img
  sheet:drawImage(img,Point(col*size,row*size))
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0));anim.frames[f+1].duration=times[f+1]
end
local tags=popping and {{'bubble-pop',1,6},{'airborne',7,8}} or {{'inflate',1,6},{inside and 'enter' or 'mount',7,9},{inside and 'float-inside' or 'ride',10,12}}
if jumpingOut then tags={{'anticipation',1,2},{'takeoff-pop',3,4},{'ascend',5,8}} end
for _,v in ipairs(tags) do local t=anim:newTag(v[2],v[3]);t.name=v[1] end
sheet:saveAs(root..'/'..prefix..'-sheet-v1.png')
anim:saveAs(root..'/'..prefix..'-v1.aseprite')
if popping or jumpingOut then
  anim:saveAs(root..'/'..prefix..'-preview-v1.gif')
  print(count..' frames, 4x'..rows..' grid; frame size '..size..'x'..size..'; fixed scale '..scale)
  return
end
-- Hold the ride loop longer in the demonstration before replaying the ability.
for n=1,3 do for f=10,12 do
  local frame=anim:newEmptyFrame()
  anim:newCel(anim.layers[1],frame,frames[f],Point(0,0));frame.duration=0.35
end end
anim:saveAs(root..'/'..prefix..'-preview-v1.gif')
local ride=Sprite(size,size,ColorMode.RGB)
for f=10,12 do
  if f>10 then ride:newEmptyFrame() end
  ride:newCel(ride.layers[1],f-9,frames[f],Point(0,0));ride.frames[f-9].duration=0.35
end
ride:saveAs(root..'/'..prefix..'-ride-v1.gif')
print('12 frames, 4x3 grid; frame size '..size..'x'..size..'; fixed scale '..scale)
