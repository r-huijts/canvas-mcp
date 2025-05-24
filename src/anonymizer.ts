export class DataAnonymizer {
  private static userNameMap = new Map<string, string>();
  private static userCounter = 1;

  /**
   * Anonymize a user object (student only, preserves teacher/admin data)
   */
  static anonymizeUser(user: any): any {
    if (!user || !user.id) return user;
    
    // Only anonymize if this is a student (no role specified means student context)
    // Teachers/admins typically have explicit roles in the data
    const userId = user.id.toString();
    
    if (!this.userNameMap.has(userId)) {
      this.userNameMap.set(userId, `Student ${this.userCounter++}`);
    }

    const anonymizedName = this.userNameMap.get(userId);

    return {
      ...user,
      name: anonymizedName,
      display_name: anonymizedName,
      email: user.email ? `student${userId}@example.com` : undefined
    };
  }

  /**
   * Anonymize an array of users
   */
  static anonymizeUsers(users: any[]): any[] {
    if (!Array.isArray(users)) return users;
    return users.map(user => this.anonymizeUser(user));
  }

  /**
   * Anonymize submission data including user and comment authors
   */
  static anonymizeSubmission(submission: any): any {
    if (!submission) return submission;

    const anonymized = { ...submission };

    // Anonymize the main user
    if (submission.user) {
      anonymized.user = this.anonymizeUser(submission.user);
    }

    // Anonymize comment authors (only students, preserve teacher comments)
    if (submission.submission_comments && Array.isArray(submission.submission_comments)) {
      anonymized.submission_comments = submission.submission_comments.map((comment: any) => {
        const commentCopy = { ...comment };
        
        // Only anonymize if the author is a student (not teacher/admin)
        if (comment.author && comment.author.role === 'student') {
          commentCopy.author = this.anonymizeUser(comment.author);
        }
        
        return commentCopy;
      });
    }

    return anonymized;
  }

  /**
   * Anonymize an array of submissions
   */
  static anonymizeSubmissions(submissions: any[]): any[] {
    if (!Array.isArray(submissions)) return submissions;
    return submissions.map(submission => this.anonymizeSubmission(submission));
  }

  /**
   * Anonymize assignment data that may include submission info
   */
  static anonymizeAssignment(assignment: any): any {
    if (!assignment) return assignment;

    const anonymized = { ...assignment };

    // If assignment includes submission data
    if (assignment.submission) {
      anonymized.submission = this.anonymizeSubmission(assignment.submission);
    }

    return anonymized;
  }

  /**
   * Anonymize an array of assignments
   */
  static anonymizeAssignments(assignments: any[]): any[] {
    if (!Array.isArray(assignments)) return assignments;
    return assignments.map(assignment => this.anonymizeAssignment(assignment));
  }

  /**
   * Reset the anonymization state (useful for testing)
   */
  static reset(): void {
    this.userNameMap.clear();
    this.userCounter = 1;
  }
} 