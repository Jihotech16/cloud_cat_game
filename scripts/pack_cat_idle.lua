-- Pack generated drawings only; no procedural character drawing.
local sourcePath = app.params["source"] or "resources/cat-idle/source.png"
local outputPath = app.params["sheet"] or "assets/cat-idle-sheet.png"
local animationPath = app.params["animation"] or "resources/cat-idle/idle.aseprite"
local targetHeight = tonumber(app.params["height"]) or 96
local src = Image{fromFile=sourcePath}
local boxes = {}
local maxHeight, maxWidth = 0, 0
for f=0,3 do
  local left, right = math.floor(f*src.width/4), math.floor((f+1)*src.width/4)-1
  local b = {x0=right, x1=left, y0=src.height-1, y1=0}
  for y=0,src.height-1 do
    for x=left,right do
      if app.pixelColor.rgbaA(src:getPixel(x,y)) > 128 then
        b.x0=math.min(b.x0,x); b.x1=math.max(b.x1,x)
        b.y0=math.min(b.y0,y); b.y1=math.max(b.y1,y)
      end
    end
  end
  boxes[f+1]=b
  maxHeight=math.max(maxHeight,b.y1-b.y0+1)
  maxWidth=math.max(maxWidth,b.x1-b.x0+1)
end
local scale=math.min(targetHeight/maxHeight,104/maxWidth)
local sheet=Image(512,128,ColorMode.RGB)
sheet:clear()
local anim=Sprite(128,128,ColorMode.RGB)
local durations={1.1,0.55,0.12,0.65}
for f=0,3 do
  local b=boxes[f+1]
  local w=math.floor((b.x1-b.x0+1)*scale+0.5)
  local h=math.floor((b.y1-b.y0+1)*scale+0.5)
  local img=Image(128,128,ColorMode.RGB)
  img:clear()
  local dx=math.floor((128-w)/2)
  local dy=112-h
  for y=0,h-1 do
    for x=0,w-1 do
      local sx=math.min(b.x1,b.x0+math.floor(x/scale))
      local sy=math.min(b.y1,b.y0+math.floor(y/scale))
      local pixel=src:getPixel(sx,sy)
      img:drawPixel(dx+x,dy+y,pixel)
      sheet:drawPixel(f*128+dx+x,dy+y,pixel)
    end
  end
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0))
  anim.frames[f+1].duration=durations[f+1]
end
sheet:saveAs(outputPath)
anim:saveAs(animationPath)
print("Saved 4 x 128x128 idle frames")
