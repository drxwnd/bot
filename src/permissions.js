// Who can do what. Every account has an owner. Team members act on the owner's behalf with a
// narrower role. The account kind comes from the owner's user role (tradie, customer or admin).

const RULES = {
  tradie: {
    owner: ['quote', 'work.view', 'work.manage', 'money', 'profile', 'payouts', 'team'],
    manager: ['quote', 'work.view', 'work.manage', 'money', 'profile'],
    worker: ['work.view'],
  },
  customer: {
    owner: ['post', 'accept', 'pay', 'team'],
    manager: ['post', 'accept', 'pay'],
    staff: ['post'],
  },
  admin: {
    owner: ['admin', 'money', 'team'],
    support: ['admin'],
  },
};

// Roles an owner can give to team members, in the order shown on the team page.
const TEAM_ROLES = {
  tradie: [
    { slug: 'manager', name: 'Manager', hint: 'Quotes on jobs, runs the work, sees prices and payments' },
    { slug: 'worker', name: 'Worker', hint: 'Sees only the jobs assigned to them, logs hours, notes and photos. No prices.' },
  ],
  customer: [
    { slug: 'manager', name: 'Manager', hint: 'Posts jobs, accepts quotes, pays and releases payments' },
    { slug: 'staff', name: 'Staff', hint: 'Posts jobs and compares quotes. A manager accepts and pays.' },
  ],
  admin: [{ slug: 'support', name: 'Support', hint: "Approves tradies and sees everything. Can't release or refund money." }],
};

const ROLE_NAMES = { owner: 'Owner', manager: 'Manager', worker: 'Worker', staff: 'Staff', support: 'Support' };

function can(req, action) {
  if (!req.user || !req.account) return false;
  const rules = RULES[req.user.role];
  return Boolean(rules && rules[req.account.role] && rules[req.account.role].includes(action));
}

module.exports = { RULES, TEAM_ROLES, ROLE_NAMES, can };
