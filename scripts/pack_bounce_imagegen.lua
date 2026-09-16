-- Pack the approved ImageGen sheet into equal integer-sized animation cells.
-- Run with Aseprite --batch --script from the project root.
local src = Image{fromFile="resources/cloud-sheets/cloud-bounce-imagegen-v3.png"}
local count = 4
local width = math.ceil(src.width / count)
local sheet = Image(width * count, src.height, ColorMode.RGB)
sheet:clear()
for f=0,count-1 do
  local left = math.floor(f * src.width / count + 0.5)
  local right = math.floor((f+1) * src.width / count + 0.5)
  for y=0,src.height-1 do
    for x=left,right-1 do
      sheet:drawPixel(f*width+x-left,y,src:getPixel(x,y))
    end
  end
end
sheet:saveAs("assets/cloud-bounce-imagegen-v3-sheet.png")
print(string.format("Packed %d frames of %dx%d, preserving RGBA pixels",count,width,src.height))
