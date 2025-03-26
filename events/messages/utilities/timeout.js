export const timeoutUser = async (targetUserId, guild) => {   
  try {
    // Get the member from the guild
    const member = await guild.members.fetch(targetUserId);
      
    // Now you have the GuildMember object and can use timeout
    await member.timeout(10 * 60 * 1000, 'CURSE OF RA'); // 10 minutes in milliseconds
      
    // Confirm the timeout
    return `<@${targetUserId}> will suffer the pharaoh's curse of silence for 10 minutes.`;

  } catch (error) {
    return `Failed to apply timeout: ${error.message} pls tell justin lol`;
  }
};