-- New calm art, aligned to the existing 128x50 strike frames.
local src=Image{fromFile="resources/cloud-sheets/thunder/idle/source.png"}
local attack=Image{fromFile="assets/cloud-thunder-sheet.png"}
local top=src.height-1
for y=0,src.height-1 do
  for x=0,src.width-1 do
    if app.pixelColor.rgbaA(src:getPixel(x,y))>128 then top=math.min(top,y) end
  end
end
local idleSheet=Image(512,50,ColorMode.RGB)
local combined=Image(896,50,ColorMode.RGB)
idleSheet:clear(); combined:clear()
local frames={}
local cellWidth=src.width/4
local scale=128/cellWidth
for f=0,3 do
  local img=Image(128,50,ColorMode.RGB)
  img:clear()
  for y=1,49 do
    for x=0,127 do
      local sx=math.min(src.width-1,math.floor(f*cellWidth+x/scale))
      local sy=top+math.floor((y-1)/scale)
      if sy<src.height then img:drawPixel(x,y,src:getPixel(sx,sy)) end
    end
  end
  frames[#frames+1]=img
  idleSheet:drawImage(img,Point(f*128,0))
end
for f=1,3 do
  local img=Image(128,50,ColorMode.RGB)
  img:clear()
  for y=0,49 do
    for x=0,127 do img:drawPixel(x,y,attack:getPixel(f*128+x,y)) end
  end
  frames[#frames+1]=img
end
local idleAnim=Sprite(128,50,ColorMode.RGB)
local cycle=Sprite(128,50,ColorMode.RGB)
local durations={1.5,1.5,1.5,1.5,0.6,8/60,26/60}
for i,img in ipairs(frames) do
  combined:drawImage(img,Point((i-1)*128,0))
  if i>1 then cycle:newEmptyFrame() end
  cycle:newCel(cycle.layers[1],i,img,Point(0,0))
  cycle.frames[i].duration=durations[i]
  if i<=4 then
    if i>1 then idleAnim:newEmptyFrame() end
    idleAnim:newCel(idleAnim.layers[1],i,img,Point(0,0))
    idleAnim.frames[i].duration=1.5
  end
end
idleSheet:saveAs("assets/cloud-thunder-idle-sheet.png")
combined:saveAs("assets/cloud-thunder-cycle-sheet.png")
idleAnim:saveAs("resources/cloud-sheets/thunder/idle/idle.aseprite")
cycle:saveAs("resources/cloud-sheets/thunder/idle/cycle.aseprite")
print("Saved idle 512x50 and full cycle 896x50")
