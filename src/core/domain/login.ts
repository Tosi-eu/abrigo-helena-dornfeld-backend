export class Login {
    id: number;
    login: string;
    password: string;

    constructor(id: number, login: string, password: string) {
        this.id = id
        this.login = login
        this.password = password
    }
}