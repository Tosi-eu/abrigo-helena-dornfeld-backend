export interface Login {
  first_name?: string;
  last_name?: string;
  login: string;
  password: string;
}

export interface LoginCreateWithTenant extends Login {
  tenant_id: number;
}
