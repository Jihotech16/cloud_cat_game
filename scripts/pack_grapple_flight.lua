-- Pack ImageGen drawings without procedurally redrawing the character.
local root='resources/cat-grapple/'
local action=app.params['action'] or 'flight'
assert(action=='flight' or action=='fire','Unknown grapple action')
local src=Image{fromFile=root..action..'-source-v1.png'}
local cw,ch=src.width/4,src.height/2
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
local scale=64/(right-left+1)
local size=math.ceil(math.max(cw,ch)*scale/16)*16
local sheet=Image(size*4,size*2,ColorMode.RGB);sheet:clear()
local anim=Sprite(size,size,ColorMode.RGB)
local frames={}
local times={0.35,0.35,0.09,0.10,0.14,0.14,0.14,0.14}
if action=='fire' then times={0.5,0.14,0.07,0.09,0.10,0.12,0.15,0.55} end
for f=0,7 do
  local col,row=f%4,math.floor(f/4)
  local x0,y0=math.floor(col*cw),math.floor(row*ch)
  local x1,y1=math.floor((col+1)*cw)-1,math.floor((row+1)*ch)-1
  local img=Image(size,size,ColorMode.RGB);img:clear()
  local dx,dy=(size-cw*scale)/2,(size-ch*scale)/2
  for y=0,size-1 do for x=0,size-1 do
    local sx=x0+math.floor((x-dx)/scale);local sy=y0+math.floor((y-dy)/scale)
    if sx>=x0 and sx<=x1 and sy>=y0 and sy<=y1 then img:drawPixel(x,y,src:getPixel(sx,sy)) end
  end end
  frames[f+1]=img
  sheet:drawImage(img,Point(col*size,row*size))
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0));anim.frames[f+1].duration=times[f+1]
end
local tags=action=='fire' and {{'ready',1,2},{'fire-recoil',3,4},{'recover-brace',5,8}} or {{'charge',1,2},{'launch',3,4},{'flight-loop',5,8}}
for _,v in ipairs(tags) do
  local tag=anim:newTag(v[2],v[3]);tag.name=v[1]
end
sheet:saveAs(root..action..'-sheet-v1.png')
anim:saveAs(root..action..'-v1.aseprite')
if action=='fire' then
  anim:saveAs(root..'fire-preview-v1.gif')
  print('8 firing frames; '..size..'px cells; shared scale '..scale)
  return
end
for n=1,3 do for f=5,8 do
  local frame=anim:newEmptyFrame()
  anim:newCel(anim.layers[1],frame,frames[f],Point(0,0));frame.duration=times[f]
end end
anim:saveAs(root..'flight-preview-v1.gif')
local loop=Sprite(size,size,ColorMode.RGB)
for f=5,8 do
  if f>5 then loop:newEmptyFrame() end
  loop:newCel(loop.layers[1],f-4,frames[f],Point(0,0));loop.frames[f-4].duration=times[f]
end
loop:saveAs(root..'flight-loop-v1.gif')
print('8 frames; '..size..'px cells; shared scale '..scale)
