const { app, BrowserWindow,  Menu, MenuItem } = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win, contents;

function createWindow () {

  // Create the browser window.
  var configuration;
  if(process.platform == "darwin"){
      configuration = {
          width: 800,
          height: 600,
          titleBarStyle: 'customButtonsOnHover',
          title: "Melt"
      }
  }else{
      configuration = {
          width: 800,
          height: 600,
          frame: false,
          title: "Melt"
      }
  }

  win = new BrowserWindow(configuration);
  contents = win.webContents;
  win.maximize();
  win.show();

  // and load the index.html of the app.
  win.loadFile('client/index.html')

  // Open the DevTools.
  // win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })


  // Other code removed for brevity

  const application = {
      label: 'Application',
      submenu: [{
          label:'Toggle Inspector',
          accelerator: 'CmdOrCtrl+I',
          click() {
              ToggleDevTools();
          }
      },{
      label:'Quit',accelerator: "CmdOrCtrl+Q",
          click() {
              app.quit()
          }
        }
    ]}

    const edit = {
    label: "Edit",
    submenu: [
      {
        label: "Undo",
        accelerator: "CmdOrCtrl+Z",
        selector: "undo:"
      },
      {
        label: "Redo",
        accelerator: "Shift+CmdOrCtrl+Z",
        selector: "redo:"
      },
      {
        type: "separator"
      },
      {
        label: "Cut",
        accelerator: "CmdOrCtrl+X",
        selector: "cut:"
      },
      {
        label: "Copy",
        accelerator: "CmdOrCtrl+C",
        selector: "copy:"
      },
      {
        label: "Paste",
        accelerator: "CmdOrCtrl+V",
        selector: "paste:"
      },
      {
        label: "Select All",
        accelerator: "CmdOrCtrl+A",
        selector: "selectAll:"
      }
    ]
  }

  const template = [
    application,
    edit
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))


}// create window


function ToggleDevTools(){
    if(contents.isDevToolsOpened()){
        contents.closeDevTools();
    }else{
        contents.openDevTools();
    }
}

app.on('will-quit', () => {

  // Unregister all shortcuts.
  // globalShortcut.unregisterAll()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== 'darwin') {
    app.quit()
  // }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  // if (win === null) {
  //   createWindow()
  // }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
