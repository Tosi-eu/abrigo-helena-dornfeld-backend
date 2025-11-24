    import { RemanejamentoDTO } from "../database/models/armario.model";

    export function validateDTO(dto: any): dto is RemanejamentoDTO {
    const allowedKeys = ["destinoMedicamentos", "destinoInsumos"];
    return Object.keys(dto).every(key => allowedKeys.includes(key));
    }
