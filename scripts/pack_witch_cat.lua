-- Normalize generated artwork to the existing 128px frame contract.
for _,entry in ipairs({{"jumpready",3},{"jumping",4}}) do
  local name,count=entry[1],entry[2]
  local src=Image{fromFile="resources/witch-cat/"..name.."-source.png"}
  local sheet=Image(128*count,128,ColorMode.RGB)
  sheet:clear()
  local animation=Sprite(128,128,ColorMode.RGB)
  animation.layers[1].name="Witch cat - "..name
  local scale=128/math.max(src.width/count,src.height)
  for f=0,count-1 do
    local left=math.floor(f*src.width/count+0.5)
    local right=math.floor((f+1)*src.width/count+0.5)
    local drawW=math.floor((right-left)*scale)
    local drawH=math.floor(src.height*scale)
    local ox=math.floor((128-drawW)/2)
    local oy=math.floor((128-drawH)/2)
    local img=Image(128,128,ColorMode.RGB)
    img:clear()
    for y=0,drawH-1 do
      for x=0,drawW-1 do
        img:drawPixel(ox+x,oy+y,src:getPixel(left+math.min(right-left-1,math.floor(x/scale)),math.min(src.height-1,math.floor(y/scale))))
      end
    end
    if f>0 then animation:newEmptyFrame() end
    animation:newCel(animation.layers[1],f+1,img,Point(0,0))
    animation.frames[f+1].duration=0.18
    sheet:drawImage(img,Point(f*128,0))
  end
  sheet:saveAs("assets/cat-witch-"..name..".png")
  animation:saveAs("resources/witch-cat/"..name..".aseprite")
  animation:close()
end
