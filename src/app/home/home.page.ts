import { Component, OnInit } from '@angular/core';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { BluetoothSerial } from '@ionic-native/bluetooth-serial/ngx';
import { BluetoothLE } from '@ionic-native/bluetooth-le/ngx';
import * as _ from 'underscore';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(private bluetoothSerial: BluetoothSerial, private toastController: ToastController,
    private androidPermissions: AndroidPermissions, private bluetoothLE: BluetoothLE, private loadingController: LoadingController) {}

  public devices: any[];
  public tipo: 'envio' | 'recibir';
  public textSend: any;
  public loadingModal: any;
  public service: any = '1234';
  public char: any = 'ABCD';
  public enEsperaInfo: boolean;

  ngOnInit(): void {
    this.devices = [];
    this.iniciarBt();
  }

  public envio() {

    this.tipo = "envio";

    this.bluetoothLE.initialize({
      request: true,
      statusReceiver: false
    }).subscribe(rpta => {

      console.info("Bluetooth encendido", rpta);
      this.escanear();
    }, error => {
      console.info("Error al inicializar", error);
      this.createMessage("Error al inicializar "+ error.message);
      this.loadingModal.dismiss();
    });
  }

  public async iniciarBt() {

    try {

      let permiso = await this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.BLUETOOTH_PRIVILEGED);
      
      if (!permiso.hasPermission) {
        let reqPermiso = await this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.BLUETOOTH_PRIVILEGED);

        if (!reqPermiso.hasPermission) {
          setTimeout(async () => {

            let per = await this.bluetoothLE.hasPermission();

            if (!per.hasPermission) {
              let permission = await this.bluetoothLE.requestPermission();

              if (!permission.requestPermission) {
                console.info("No activado");
                return;
              }
            }

            let perLoc = await this.bluetoothLE.isLocationEnabled();

            if (!perLoc.isLocationEnabled) {
              let loc = await this.bluetoothLE.requestLocation();

              if (!loc.requestLocation) {
                console.info("No activado");
                return;
              }
            }

            this.createMessage("Iniciado correctamente");
          }, 800);
        }
      }

      let act = await this.bluetoothLE.isEnabled();
      if (!act.isEnabled) this.bluetoothSerial.enable();
    } catch (error) {
      this.createMessage("Bt no iniciado "+ error.message);
      console.info("Bt no iniciado", error);
    } 
  }

  public recibir() {

    this.tipo = "recibir";

    this.bluetoothLE.initialize({
      request: true,
      statusReceiver: false
    }).subscribe(rpta => {

      console.info("Bluetooth encendido", rpta);

      this.bluetoothLE.initializePeripheral({
        "request": true,
        "restoreKey": "bluetoothleplugin"
      }).subscribe(async data => {
        console.info("iniciado", data);

        try {

          if (data.status == "connected") {
            this.createMessage("Conectado..");
          } else if (data.status == "disconnected") {
            this.disconnect({
              "address": data.address,
            })
          } else if (data.status == "enabled") {

            let rpta = await this.bluetoothLE.addService({
              service: this.service,
              characteristics: [{
                uuid: this.char,
                permissions: {
                  read: true,
                  write: true,
                },
                properties: {
                  read: true,
                  writeWithoutResponse: true,
                  write: true,
                  notify: true,
                  indicate: true,
                }
              }]
            });

            console.info("servicio añadido", rpta);

            let rptaAd = await this.bluetoothLE.startAdvertising({
              "services": [this.service], //iOS
              "service": this.service, //Android
              "name": "Prueba",
            });

            console.info("servicio iniciado(" + this.service + ',' + this.char + ')', rptaAd);
            await this.createMessage("servicio iniciado(" + this.service + ',' + this.char + ')');

            this.showVisible();

            this.enEsperaInfo = true;
          } else if (data.status == "writeRequested") {
            var encodedString = this.bluetoothLE.encodedStringToBytes(data.value);
            var text = this.bluetoothLE.bytesToString(encodedString);
            console.info("Llego texto", text);
            alert(text);
            this.disconnect(data);
          }

        } catch (error) {
          console.info("Error añadiendo el servicio", error);
          this.createMessage("Error añadiendo el servicio "+ error.message);
          this.enEsperaInfo = false;
        }
      }, error => {
        this.createMessage("Error al inicializar dispositivo "+ error.message);
        console.info("Error al inicializar dispositivo", error);
      })
    }, error => {
      this.createMessage("Error al inicializar "+ error.message);
      console.info("Error al inicializar", error);
    });
  }

  async escanear() {
    console.info("Iniciando escaneo");
    this.devices = [];
    this.loading();

    console.info("Escaneo iniciado con exito");
    this.createMessage("Escaneo iniciado con exito");

    try {
      let data = await this.bluetoothSerial.discoverUnpaired();
      console.info(data);
      this.loadingModal.dismiss();
      let dev = data.filter(d => d.name);
      this.devices = _.uniq(dev, "address");
      this.createMessage("Escaneo finalizado");
    } catch (error) {
      this.createMessage("Error al escanear "+ error.message);
      console.info("Error al escanear", error);
      this.loadingModal.dismiss();
    }
  }

  public async sendInfo(device: any) {
    if (device.address && this.textSend) {

      try {

        let deviceConnect = await this.bluetoothLE.isConnected({
          address: device.address
        });

        if (deviceConnect.isConnected)
          this.sendData(device);
        else {
          console.info("Error conectado");
          let infoConnect = await this.connect(device);
          this.sendData(infoConnect);
        }
      } catch (error) {
        this.createMessage("Conexión rechazada "+ error.message);
        console.info("conexión rechazada", error);
        let infoConnect = await this.connect(device);
        this.sendData(infoConnect);
      }
    } else if (!this.textSend) {
      alert("Porfavor coloque información en el campo de texto");
    }
  }

  public async connect(device) {

    return new Promise((resolve, reject) => {
      this.bluetoothLE.connect({
        address: device.address
      }).subscribe(async data => {
        device.connect = true;

        if (data.status == "connected") {
          console.info("Conectado a dispositivo", data);
          this.createMessage("Conectado");

          setTimeout(async ()=>{
            try {
              let infoDev = await this.bluetoothLE.discover({
                address: device.address,
                "clearCache": true
              });
              console.info("servicios", infoDev);
              this.createMessage("Servicios listados");
              resolve(device);
            } catch (error) {
              reject(error);
            }
          }, 1000)
        }
        else {
          console.info("Desconectado a dispositivo", data);
          this.createMessage("Desconectado a dispositivo");
        }

      }, error => {
        reject(error);
      });
    })
  }

  public async sendData(device: any) {
    if (device.address) {
      try {
        console.info("Enviando info");

        var bytes = this.bluetoothLE.stringToBytes(this.textSend);
        var encodedString = this.bluetoothLE.bytesToEncodedString(bytes);

        let rpta = await this.bluetoothLE.write({
          address: device.address,
          service: this.service,
          value: encodedString,
          characteristic: this.char
        });

        this.createMessage("Información enviada");
        this.disconnect(device);
      } catch (error) {
        this.createMessage("No se pudo enviar "+ error.message);
        console.info("No se pudo enviar", error);
      }
    }
  }

  public async disconnect(device: any) {
    if (device.address) {
      try {
        // let data = await this.bluetoothLE.disconnect({ address: device.address });
        let dataClose = await this.bluetoothLE.close({
          address: device.address
        });
        this.enEsperaInfo = false;
        console.info("Desconectado", dataClose);
        this.createMessage("Dispositivo desconectado");
      } catch (error) {
        this.createMessage("No se desconecto "+ error.message);
        console.info("No se desconecto", error);
      }
    }
  }

  public async removeServices() {
    try {
      let data = await this.bluetoothLE.removeAllServices();
      console.info("servicios removidos", data);
      this.createMessage("Servicios removidos");
    } catch (error) {
      this.createMessage("servicios no removidos "+ error.message);
      console.info("servicios no removidos", error);
    }
  }

  public showVisible() {
    console.info("haciendo visible");
    // setTimeout(()=>{
    //   this.createMessage("Es visible");
    // }, 800);
    this.bluetoothSerial.setDiscoverable(20);
  }
 
  private async createMessage(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 1500
    });
    toast.present();
  }

  public async finalizar() {
    try {
      await this.bluetoothLE.stopAdvertising();
      await this.bluetoothLE.removeAllServices();
      this.bluetoothLE.disable();
      this.tipo = null;
      this.createMessage("Finalizado correctamente");
    } catch (error) {
      this.createMessage("servicios no removidos " + error.message);
      console.info("servicios no removidos", error);
    }
  }

  private async loading() {
    const loading = await this.loadingController.create({
      message: 'Buscando...'
    });
    await loading.present();
    this.loadingModal = loading;
  }
}