import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Http } from '@angular/http';
import { MatDialog } from '@angular/material';
import { UserService } from './../services/user.service';
import { PageService } from './../services/page.service';
import { CustomContentDialog } from './dialogs/customcontentdialog.component';
import { GlossaryService } from './../services/glossary.service';
import { AudioPage } from '../components/baseaudiopage.component';

@Component({
  selector: 'bb11',
  template: `
    <div class="container">
      <div class="row">
        <div class="col-md-8 col-md-offset-2">
          <bbheader>Banks</bbheader>
          <div>
            <p class="narrator-text">
              You already know something about
              <a class="glossary-word-default" (click)="displayGlossary($event)">Bank</a>s. You know there are large
              national and international banks, as well as small community banks.
            </p>
          </div>
          <br />
          <img width="100%" src="../../assets/img/bbpage11img2.jpg" class="img-responsive" />
          <br />
          <div>
            <p class="narrator-text">
              You, like most American teens, may already have your
              <a class="glossary-word-default" (click)="displayGlossary($event)">Bank Account</a> or maybe a parent or
              guardian has set one up for you. But did you know that there are alternatives to banks? And no, we’re not
              talking about a shoe box or under your mattress.
            </p>
          </div>
        </div>
      </div>
      <!--Content to display in glossary popup modal.-->
      <ng-template #glossaryContent>
        <div class="display-same-line">
          <span class="text-capitalize bold-text">{{ glossaryService.getTerm() }}:</span><br />
          <span class="preserve-newline">{{ glossaryService.getDefinition() }}</span>

          <!--Display hyperlinks if any -->
          <div
            class="display-same-line"
            *ngFor="let hyperLinkText of glossaryService.getHyperLinkTextList(); last as isLast"
          >
            <u class="glossary-word-default" (click)="displayRelatedGlossary($event)">{{ hyperLinkText }}</u>
            <span *ngIf="!isLast">&nbsp;&nbsp;</span>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styleUrls: ['./segement2.component.css']
})
export class bbPage11Component extends AudioPage implements OnInit {
  @ViewChild('glossaryContent') glossaryContentRef: TemplateRef<CustomContentDialog>;
  private glossaryDialogRef: any = null;

  constructor(
    public userInfo: UserService,
    public pageInfo: PageService,
    private http: Http,
    public glossaryService: GlossaryService,
    private dialog: MatDialog
  ) {
    //  console.log(userInfo.user.guide);
    super('../assets/audio/BB11-BB_Part7.m4a', pageInfo);
    pageInfo.TurnOnReviewButton();
    pageInfo.TurnOnChillButton();
    pageInfo.TurnOnLogoutButton();
    pageInfo.TurnOnAudioButton();
  }

  ngOnInit() {
    this.playGuideAudio();
  }

  /**
   * Update glossary info in the displayed popup window.
   * @param event The HTML anchor element that was clicked on one of the related terms followd by the "See: " tag
   */
  private displayRelatedGlossary(event) {
    this.glossaryService.setData(
      event.target.textContent,
      this.dialog,
      this.glossaryDialogRef,
      this.glossaryContentRef
    );
  }

  /**
   * Displays glossary item in a popup window.
   * @param event The HTML anchor element that was clicked.
   */
  displayGlossary(event) {
    this.glossaryService.setData(event.target.textContent, this.dialog, null, this.glossaryContentRef);
    this.glossaryService.displayGlossary();
    this.glossaryDialogRef = this.glossaryService.getDialogRef();
  }
}
