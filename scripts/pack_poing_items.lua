-- Normalize generated artwork into transparent 64px item cells; no redrawing.
local letters={"P","O","I","N","G"}
local sheet=Image(320,64,ColorMode.RGB)
sheet:clear()
for index,letter in ipairs(letters) do
  local src=Image{fromFile="resources/poing-items/"..letter.."-source.png"}
  local x0,y0,x1,y1=src.width,src.height,0,0
  for y=0,src.height-1 do
    for x=0,src.width-1 do
      if app.pixelColor.rgbaA(src:getPixel(x,y))>128 then
        x0=math.min(x0,x); x1=math.max(x1,x)
        y0=math.min(y0,y); y1=math.max(y1,y)
      end
    end
  end
  local scale=56/math.max(x1-x0+1,y1-y0+1)
  local w=math.floor((x1-x0+1)*scale+0.5)
  local h=math.floor((y1-y0+1)*scale+0.5)
  local dx,dy=math.floor((64-w)/2),math.floor((64-h)/2)
  local img=Image(64,64,ColorMode.RGB)
  img:clear()
  for y=0,h-1 do
    for x=0,w-1 do
      local pixel=src:getPixel(math.min(x1,x0+math.floor(x/scale)),math.min(y1,y0+math.floor(y/scale)))
      img:drawPixel(dx+x,dy+y,pixel)
      sheet:drawPixel((index-1)*64+dx+x,dy+y,pixel)
    end
  end
  img:saveAs("assets/poing-"..letter:lower()..".png")
end
sheet:saveAs("assets/poing-items-sheet.png")
print("Saved five 64x64 items and a 320x64 sheet")
