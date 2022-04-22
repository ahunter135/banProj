import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'banProj';
  address: any;
  image: any;
  constructor(private http: HttpClient) {
    this.getPhoto();
  }

  onFileChanged(ev: any) {
    // Get file and convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(ev.target.files[0]);
    reader.onload = async () => {
        let b64Image = reader.result;
        let res = await this.http.post("http://localhost:8020/make_a_deposit", {image: b64Image}, {responseType: 'text'}).toPromise();
        console.log(res);
        try {
          this.address = res;
          console.log(res);
        } catch (error) {
          console.log(error);
        }
    };
  }

  async getPhoto() {
    this.image = await this.http.get("http://localhost:8020/getPhoto", {responseType: 'text'}).toPromise();
    setInterval(async () => {
      this.image = await this.http.get("http://localhost:8020/getPhoto", {responseType: 'text'}).toPromise();
    }, 10000)
  }
}
