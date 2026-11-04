import { guildId } from "../../configVars.js";
import { sendUsageError } from "../../utilities/commandHelpers.js";
import {
  ColorRoleError,
  applyColorRole,
  parseHex,
  removeColorRole,
  withUserLock,
} from "../../utilities/colorRole.js";

const cmdName = "color-me";
const featureKey = "color_me_enabled";

const data = {
  description: "Set your name color with a personal role (hex like #ff8800), or `none` to remove it",
  usage: "color-me <#RRGGBB|none>",
};

/**
 * Usable from any guild channel and from DMs (resolves the member via the bot's configured guild).
 * Failures and validation errors go by DM; the result is a normal reply.
 */
const execute = async (message, args) => {
  const arg = args[0]?.trim();
  const remove = arg?.toLowerCase() === "none";
  const hex = remove ? null : parseHex(arg);
  if (!arg || args.length > 1 || (!remove && !hex)) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  const dm = (text) => message.author.send(text).catch(() => null);
  const guild = await message.client.guilds.resolve(guildId).catch(() => null);
  const member =
    message.member ?? (await guild?.members.resolve(message.author.id).catch(() => null));
  if (!guild || !member) {
    await dm("I couldn't find you in the server.");
    return;
  }

  try {
    const result = await withUserLock(member.id, async () => {
      if (remove) return (await removeColorRole(guild, member.id, member)) ? "removed" : "none";
      await applyColorRole(guild, member, hex);
      return "set";
    });
    if (result.busy) {
      await dm("I'm still working on your last color change — try again in a moment.");
    } else if (result.value === "set") {
      await message.reply(`Your name color is now #${hex}.`);
    } else if (result.value === "removed") {
      await message.reply("Your color role has been removed.");
    } else {
      await dm("You don't have a color role to remove.");
    }
  } catch (err) {
    if (err instanceof ColorRoleError) {
      await dm(err.message);
      return;
    }
    console.error("bot: color-me failed:", err);
    await dm("Something went wrong setting your color. Please try again later.");
  }
};

export { cmdName, data, execute, featureKey };
