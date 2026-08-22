import { User } from "../models/User.js";
import { Role } from "../models/Role.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import type { LoginInput, ChangePasswordInput } from "../validations/authValidation.js";
import type { IUser } from "../types/index.js";

export class AuthService {
  async login(input: LoginInput) {
    const user = await User.findOne({ email: input.email.toLowerCase() })
      .select("+password")
      .populate("role");

    if (!user) {
      throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    if (user.status === "inactive") {
      throw Object.assign(new Error("Your account has been deactivated"), { statusCode: 403 });
    }

    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      roleId: (user.role as { _id: { toString(): string } })._id.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Return user without password (toJSON strips it via the schema transform)
    const userObj = user.toJSON() as unknown as Omit<IUser, "password">;

    return { accessToken, refreshToken, user: userObj };
  }

  async refreshToken(token: string) {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select("status");

    if (!user || user.status === "inactive") {
      throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
    }

    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      roleId: decoded.roleId,
    };

    const accessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: string) {
    const user = await User.findById(userId).populate("role");
    if (!user) {
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    return user;
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }

    const isValid = await user.comparePassword(input.currentPassword);
    if (!isValid) {
      throw Object.assign(new Error("Current password is incorrect"), { statusCode: 400 });
    }

    user.password = input.newPassword;
    await user.save();

    return { message: "Password changed successfully" };
  }

  /**
   * Sign in the Root portal's pre-provisioned service account.
   *
   * The caller has already verified the handoff token with the portal; this
   * turns the verified identity into a normal CRM session.
   *
   * Deliberately does NOT create the user if it is missing. The service account
   * is provisioned in this CRM ahead of time, so a missing one means something
   * is wrong. Auto-creating would mean that anyone who could make this server's
   * verify call return an arbitrary email — a spoofed ROOT_ERP_API_URL, a
   * hijacked DNS record, a compromised portal — would be handed a Super Admin
   * account here, silently.
   */
  async ssoLogin(admin: { email: string; name: string; role: string }) {
    const user = await User.findOne({ email: admin.email.toLowerCase() }).populate("role");

    if (!user) {
      throw Object.assign(
        new Error(
          `No account for ${admin.email} in this CRM. Create it before using SSO.`,
        ),
        { statusCode: 401 },
      );
    }

    // Same gate as a password login: deactivating a user must lock every door,
    // not just the one with the password on it.
    if (user.status === "inactive") {
      throw Object.assign(new Error("Your account has been deactivated"), {
        statusCode: 403,
      });
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      roleId: (user.role as { _id: { toString(): string } })?._id?.toString() ?? "",
    };

    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: user.toJSON(),
    };
  }
}
