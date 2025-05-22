import { v4 as uuidv4 } from "uuid";

class UUID {
  static generateV4() {
    return uuidv4();
  }
}

export default UUID;
