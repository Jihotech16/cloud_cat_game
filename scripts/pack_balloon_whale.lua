-- Crop a shared vertical canvas and resize generated art without changing frame anchors.
local src=Image{fromFile="resources/balloon-whale/source.png"}
local top,bottom=src.height-1,0
for y=0,src.height-1 do
  for x=0,src.width-1 do
    if app.pixelColor.rgbaA(src:getPixel(x,y))>160 then
      top=math.min(top,y); bottom=math.max(bottom,y)
    end
  end
end
top=math.max(0,top-4)
bottom=math.min(src.height-1,bottom+4)
local cellWidth=src.width/4
local scale=160/cellWidth
local height=math.ceil((bottom-top+1)*scale)
local sheet=Image(640,height,ColorMode.RGB)
sheet:clear()
local anim=Sprite(160,height,ColorMode.RGB)
local durations={0.8,0.6,0.8,0.35}
for f=0,3 do
  local img=Image(160,height,ColorMode.RGB)
  img:clear()
  for y=0,height-1 do
    for x=0,159 do
      local sx=math.min(src.width-1,math.floor(f*cellWidth+x/scale))
      local sy=math.min(bottom,top+math.floor(y/scale))
      local pixel=src:getPixel(sx,sy)
      img:drawPixel(x,y,pixel)
      sheet:drawPixel(f*160+x,y,pixel)
    end
  end
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0))
  anim.frames[f+1].duration=durations[f+1]
end
sheet:saveAs("assets/balloon-whale-sheet.png")
anim:saveAs("resources/balloon-whale/animation.aseprite")
print("Whale frame dimensions: 160 x "..height)
