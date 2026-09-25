-- Layout/export only: all character and bubble drawings come from ImageGen.
local root='resources/cat-bubble'
local src=Image{fromFile=root..'/blow-source-v1.png'}
local function measure(img,x0,y0,x1,y1)
  local top,bottom=y1,y0
  local orangeTop=y1
  for y=y0,y1 do for x=x0,x1 do
    local p=img:getPixel(x,y)
    if app.pixelColor.rgbaA(p)>128 then
      top=math.min(top,y);bottom=math.max(bottom,y)
      local r,g,b=app.pixelColor.rgbaR(p),app.pixelColor.rgbaG(p),app.pixelColor.rgbaB(p)
      if r>110 and r>g*1.1 and g>b*1.2 then orangeTop=math.min(orangeTop,y) end
    end
  end end
  local left,right=x1,x0
  for y=orangeTop,math.floor(orangeTop+(bottom-orangeTop)*0.45) do for x=x0,x1 do
    local p=img:getPixel(x,y)
    local r,g,b=app.pixelColor.rgbaR(p),app.pixelColor.rgbaG(p),app.pixelColor.rgbaB(p)
    if app.pixelColor.rgbaA(p)>128 and r>110 and r>g*1.1 and g>b*1.2 then
      left=math.min(left,x);right=math.max(right,x)
    end
  end end
  return {head=right-left+1,cx=(left+right)/2,feet=bottom,x0=x0,y0=y0,x1=x1,y1=y1}
end
local ref=Image{fromFile=root..'/jumpready-sheet-v1.png'}
local target=measure(ref,0,0,127,127)
local boxes={}
for f=0,7 do
  local c=f%4;local r=math.floor(f/4)
  boxes[f+1]=measure(src,math.floor(c*src.width/4),math.floor(r*src.height/2),math.floor((c+1)*src.width/4)-1,math.floor((r+1)*src.height/2)-1)
end
-- Fixed scale for all frames. Align using cat head and feet, never bubble bounds.
local scale=target.head/boxes[1].head
local sheet=Image(1024,128,ColorMode.RGB);sheet:clear()
local anim=Sprite(128,128,ColorMode.RGB)
local times={0.9,0.2,0.25,0.3,0.25,0.3,0.3,0.6}
for f=0,7 do
  local b=boxes[f+1]
  local img=Image(128,128,ColorMode.RGB);img:clear()
  for y=0,127 do for x=0,127 do
    local sx=math.floor(b.cx+(x-target.cx)/scale)
    local sy=math.floor(b.feet+(y-111)/scale)
    if sx>=b.x0 and sx<=b.x1 and sy>=b.y0 and sy<=b.y1 then img:drawPixel(x,y,src:getPixel(sx,sy)) end
  end end
  sheet:drawImage(img,Point(128*f,0))
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0));anim.frames[f+1].duration=times[f+1]
  print('frame '..(f+1)..': head='..math.floor(b.head*scale+0.5)..'px; baseline=112')
end
local t=anim:newTag(1,8);t.name='blow-bubbles'
sheet:saveAs(root..'/blow-sheet-v1.png')
anim:saveAs(root..'/blow-v1.aseprite')
anim:saveAs(root..'/blow-preview-v1.gif')
