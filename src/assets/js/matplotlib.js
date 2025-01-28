export function patchMatplotlib(module) {
    // Switch to simpler matplotlib backend
    // Reference: https://github.com/jupyterlite/jupyterlite/blob/main/packages/pyolite-kernel/py/pyolite/pyolite/patches.py
    module.runPython(`
  import os
  os.environ["MPLBACKEND"] = "AGG"
  `);
  
    module.runPython(`
  import matplotlib
  import matplotlib.pyplot
  from pyodide.ffi import create_proxy
  from js import drawPyodideCanvas
  
  def show():
      canvas = matplotlib.pyplot.gcf().canvas
      canvas.draw()
      pixels = canvas.buffer_rgba().tobytes()
      width, height = canvas.get_width_height()
      drawPyodideCanvas(pixels, width, height)
      return None
  
  # This is probably the better approach, but the object passing stuff doesn't support typed arrays yet
  def showUint8():
      pixels_proxy = None
      pixels_buf = None
      try:
          canvas = matplotlib.pyplot.gcf().canvas
          canvas.draw()
          pixels = canvas.buffer_rgba().tobytes()
          pixels_proxy = create_proxy(pixels)
          pixels_buf = pixels_proxy.getBuffer("u8clamped")
          drawPyodideCanvas(pixels)
      finally:
          if pixels_proxy:
              pixels_proxy.destroy()
          if pixels_buf:
              pixels_buf.release()
  
  matplotlib.pyplot.show = show
  `);
  }
  
  //   from js import drawPyodideCanvas