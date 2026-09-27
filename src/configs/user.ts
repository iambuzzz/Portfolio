import type { UserData } from "~/types";
import { profile } from "~/data/profile";

const user: UserData = {
  name: profile.name,
  avatar: profile.avatar,
  password: ""
};

export default user;
